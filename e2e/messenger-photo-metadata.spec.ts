import { test, expect, type Page } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Фото в чат уходит без EXIF: шифрование не прячет от собеседника место съёмки.
 * Очистка — на настоящих байтах в браузере: JPEG с телефона теряет GPS, но не
 * пиксели и не поворот; битый JPEG (обрезан, без конца) перерисовывает canvas.
 * Сервер чатов не нужен: модуль берётся у dev-сервера напрямую.
 */

const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0))

/** JPEG 300×400 с канваса: верх красный, низ синий. */
async function drawnJpeg(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 300
    c.height = 400
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 300, 200)
    ctx.fillStyle = '#0000ff'
    ctx.fillRect(0, 200, 300, 200)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]!
  })
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

async function strip(page: Page, file: Buffer): Promise<Cleaned> {
  return page.evaluate(async (b64) => {
    const mod = '/src/b-components/messenger/services/media-metadata.ts'
    const { stripPhotoMetadata } = (await import(/* @vite-ignore */ mod)) as {
      stripPhotoMetadata: (b: Blob) => Promise<Blob>
    }
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const out = await stripPhotoMetadata(new Blob([bytes], { type: 'image/jpeg' }))
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
  }, file.toString('base64'))
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
