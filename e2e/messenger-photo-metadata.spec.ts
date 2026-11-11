import { test, expect, type Page } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Фото в чат уходит без EXIF: шифрование не прячет от собеседника место съёмки.
 * Очистка — на настоящих байтах в браузере: JPEG с телефона теряет GPS, но не
 * пиксели и не поворот; битый JPEG (обрезан, без конца) перерисовывает canvas.
 * Сервер чатов не нужен: модуль берётся у dev-сервера напрямую.
 *
 * Второй тест — фото для чата (prepareChatPhoto): снимок больше 2048 px
 * уменьшается, повёрнутый через EXIF не ложится на бок, небольшой — без пережатия.
 */

const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0))

/** JPEG с канваса (по умолчанию 300×400): верх красный, низ синий. */
async function drawnJpeg(page: Page, width = 300, height = 400): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, w, h / 2)
      ctx.fillStyle = '#0000ff'
      ctx.fillRect(0, h / 2, w, h / 2)
      return c.toDataURL('image/jpeg', 0.9).split(',')[1]!
    },
    [width, height] as const
  )
  return Buffer.from(b64, 'base64')
}

/** EXIF с «GPS!» в Make и поворотом — сразу после SOI. */
function withExif(jpeg: Buffer, orientation: number): Buffer {
  const data = [
    ...ascii('Exif\0\0II'),
    ...[42, 0, 8, 0, 0, 0, 2, 0],
    ...[0x0f, 0x01, 2, 0, 4, 0, 0, 0, ...ascii('GPS!')],
    ...[0x12, 0x01, 3, 0, 1, 0, 0, 0, orientation, 0, 0, 0],
    ...[0, 0, 0, 0],
  ]
  const len = data.length + 2
  const app1 = Buffer.from([0xff, 0xe1, len >> 8, len & 0xff, ...data])
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)])
}

interface Cleaned {
  type: string
  b64: string
  w: number
  h: number
  /** Цвет посередине верхнего края и посередине левого края. */
  top: number[]
  left: number[]
}

type CleanFn = 'stripPhotoMetadata' | 'prepareChatPhoto'

async function strip(
  page: Page,
  file: Buffer,
  fn: CleanFn = 'stripPhotoMetadata'
): Promise<Cleaned> {
  return page.evaluate(
    async ([b64, name]) => {
      const mod = '/src/b-components/messenger/services/media-metadata.ts'
      const clean = (
        (await import(/* @vite-ignore */ mod)) as Record<string, (b: Blob) => Promise<Blob>>
      )[name]!
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const out = await clean(new Blob([bytes], { type: 'image/jpeg' }))
      const outBytes = new Uint8Array(await out.arrayBuffer())
      let bin = ''
      for (const b of outBytes) bin += String.fromCharCode(b)
      const img = new Image()
      img.src = URL.createObjectURL(out)
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data)
      return {
        type: out.type,
        b64: btoa(bin),
        w: img.naturalWidth,
        h: img.naturalHeight,
        top: at(Math.floor(c.width / 2), 5),
        left: at(5, Math.floor(c.height / 2)),
      }
    },
    [file.toString('base64'), fn] as const
  )
}

const near = (rgba: number[], rgb: [number, number, number]) =>
  rgb.every((v, i) => Math.abs(rgba[i]! - v) < 40)

test('фото в чат: без места съёмки, тот же кадр и поворот; битый JPEG перерисован', async ({
  page,
}) => {
  // Холодный dev-сервер рядом с другими воркерами отдаёт приложение дольше 30 с.
  test.setTimeout(90_000)
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })

  const jpeg = await drawnJpeg(page)
  const body = jpeg.subarray(2)

  // С телефона, повёрнуто на 90° по часовой (Orientation 6).
  const turned = await strip(page, withExif(jpeg, 6))
  const turnedBytes = Buffer.from(turned.b64, 'base64')
  expect(turned.type).toBe('image/jpeg')
  expect(turnedBytes.includes(Buffer.from('GPS!'))).toBe(false)
  // Данные картинки — байт в байт: не перекодировано.
  expect(turnedBytes.subarray(turnedBytes.length - body.length).equals(body)).toBe(true)
  // Браузер поворачивает по оставшемуся тегу: 300×400 лёг в 400×300, красный верх — справа.
  expect([turned.w, turned.h]).toEqual([400, 300])
  expect(near(turned.left, [0, 0, 255])).toBe(true)

  // Обрезан: конца (EOI) нет — разобрать нельзя, canvas перерисовывает.
  const cut = withExif(jpeg.subarray(0, jpeg.length - 2), 1)
  const redrawn = await strip(page, cut)
  const redrawnBytes = Buffer.from(redrawn.b64, 'base64')
  expect(redrawn.type).toBe('image/jpeg')
  expect(redrawnBytes.includes(Buffer.from('GPS!'))).toBe(false)
  expect(redrawnBytes.includes(Buffer.from('Exif'))).toBe(false)
  expect([redrawn.w, redrawn.h]).toEqual([300, 400])
  expect(near(redrawn.top, [255, 0, 0])).toBe(true)
})

test('фото для чата: снимок больше 2048 уменьшен и не лёг на бок; небольшое — без пережатия', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })

  // Снимок 3000×2000 с телефона, повёрнутый на 90° по часовой (Orientation 6):
  // на экране он 2000×3000 и вписывается в 1365×2048.
  const big = withExif(await drawnJpeg(page, 3000, 2000), 6)
  const shrunk = await strip(page, big, 'prepareChatPhoto')
  const shrunkBytes = Buffer.from(shrunk.b64, 'base64')
  expect(shrunk.type).toBe('image/jpeg')
  expect(shrunkBytes.length).toBeLessThan(big.length)
  expect(shrunkBytes.includes(Buffer.from('GPS!'))).toBe(false)
  // Поворот впечатан в пиксели, тега больше нет — открывается так же любым клиентом.
  expect(shrunkBytes.includes(Buffer.from('Exif'))).toBe(false)
  expect([shrunk.w, shrunk.h]).toEqual([1365, 2048])
  expect(near(shrunk.left, [0, 0, 255])).toBe(true)

  // 300×400 — меньше 2048 и легче 500 КБ: те же байты, что у простой очистки.
  const small = withExif(await drawnJpeg(page), 6)
  const kept = await strip(page, small, 'prepareChatPhoto')
  const cleaned = await strip(page, small)
  expect(kept.b64).toBe(cleaned.b64)
  expect([kept.w, kept.h]).toEqual([400, 300])
})
