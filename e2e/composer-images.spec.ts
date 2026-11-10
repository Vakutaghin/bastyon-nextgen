import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Картинки в окне поста: раскладка сразу та же, что будет в ленте (широкая
 * первая — во всю ширину сверху); порядок меняется перетаскиванием картинки
 * на картинку, а брошенная на «Добавить» своя картинка не превращается в
 * копию. Пока пост публикуется, блок картинок не принимает ничего.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const DATA: MockNodeData = { profiles: [ALICE], posts: [], comments: [] }

test.use({ viewport: { width: 1366, height: 900 } })

async function openComposer(page: Page): Promise<Locator> {
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const signIn = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await signIn.locator('input, textarea').first().fill(MNEMONIC)
  await signIn.getByRole('button', { name: 'Войти' }).click()
  await expect(signIn).toBeHidden({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Создать пост' }).first().click()
  const composer = page.getByRole('dialog', { name: 'Новый пост' })
  await expect(composer).toBeVisible()
  return composer
}

/** PNG нужного размера и цвета — рисуем в браузере. */
async function png(page: Page, w: number, h: number, color: string): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([w, h, color]) => {
      const c = document.createElement('canvas')
      c.width = w as number
      c.height = h as number
      const ctx = c.getContext('2d')!
      ctx.fillStyle = color as string
      ctx.fillRect(0, 0, c.width, c.height)
      return c.toDataURL('image/png').split(',')[1]!
    },
    [w, h, color] as const
  )
  return Buffer.from(b64, 'base64')
}

async function addImages(page: Page, composer: Locator): Promise<void> {
  const files = [
    { name: 'wide.png', mimeType: 'image/png', buffer: await png(page, 900, 400, '#d00') },
    { name: 'tall.png', mimeType: 'image/png', buffer: await png(page, 400, 800, '#0a0') },
    { name: 'square.png', mimeType: 'image/png', buffer: await png(page, 600, 600, '#00d') },
  ]
  await composer.locator('input[type=file][accept="image/*"]').first().setInputFiles(files)
  await expect(composer.getByTestId('composer-image')).toHaveCount(3, { timeout: 15_000 })
}

const boxes = (composer: Locator) =>
  composer.getByTestId('composer-image').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    })
  )

/** Цвет картинки плитки: по нему видно, какая где. */
const colors = (composer: Locator) =>
  composer.getByTestId('composer-image').evaluateAll((els) =>
    els.map((el) => {
      const img = el.querySelector('img')!
      const c = document.createElement('canvas')
      c.width = 1
      c.height = 1
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return r! > 150 ? 'red' : g! > 100 ? 'green' : b! > 150 ? 'blue' : '?'
    })
  )

test('раскладка как в ленте; порядок — перетаскиванием; своя картинка на «Добавить» не копируется', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const composer = await openComposer(page)
  await addImages(page, composer)

  // Широкая первая — во всю ширину сверху, две другие — рядом под ней.
  await expect.poll(async () => (await boxes(composer)).map((b) => b.y)).not.toEqual([0, 0, 0])
  await expect
    .poll(async () => {
      const [a, b, c] = await boxes(composer)
      return a!.w > b!.w && b!.y === c!.y && a!.y < b!.y
    })
    .toBe(true)
  await expect(composer).toContainText('Перетащите картинку на другую')

  // WebKit для Windows не показывает свои MIME-типы в dataTransfer.types во
  // время dragover (подменяет на text/plain) — перетаскивание там не проверить.
  // На macOS и в Chromium типы видны.
  if (test.info().project.name === 'webkit' && process.platform === 'win32') return

  // Третью (синюю) — на место первой.
  const tiles = composer.getByTestId('composer-image')
  await tiles.nth(2).dragTo(tiles.nth(0))
  await expect.poll(() => colors(composer)).toEqual(['blue', 'red', 'green'])

  // Своя картинка, брошенная на «Добавить», копию не создаёт.
  await tiles.nth(1).dragTo(composer.getByTestId('composer-images-add'))
  await page.waitForTimeout(500)
  await expect(tiles).toHaveCount(3)
})

test('пока пост публикуется, картинки не трогаются', async ({ page }) => {
  test.setTimeout(120_000)
  // Загрузка картинок повисает — публикация идёт, сколько нужно тесту.
  await page.route('**/api/v1/images/upload**', () => new Promise(() => {}))
  await page.route('**:8092/**', () => new Promise(() => {}))
  const composer = await openComposer(page)
  await addImages(page, composer)
  await composer.getByRole('textbox').first().fill('Пост с картинками')
  const tags = composer.getByRole('textbox', { name: 'Добавьте теги…' })
  await tags.fill('фото')
  await tags.press('Enter')
  await composer.getByRole('button', { name: 'Опубликовать' }).click()

  const block = composer
    .locator('[aria-busy="true"]')
    .filter({ has: page.getByTestId('composer-images') })
  await expect(block).toBeVisible({ timeout: 15_000 })
  const tiles = composer.getByTestId('composer-image')
  await expect(tiles.first()).toHaveAttribute('draggable', 'false')
  await expect(composer.getByTestId('composer-images-add').locator('input')).toBeDisabled()
  const before = await colors(composer)
  await tiles.nth(2).dragTo(tiles.nth(0), { force: true })
  await expect.poll(() => colors(composer)).toEqual(before)
  await expect(tiles).toHaveCount(3)
})

// ─── Что уходит на сервер ────────────────────────────────────────────────────

/** Картинка, нарисованная в браузере: цвет слева и справа (или прозрачность). */
async function drawn(
  page: Page,
  w: number,
  h: number,
  left: string,
  right: string,
  type: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<Buffer> {
  const b64 = await page.evaluate(
    ([w, h, left, right, type, quality]) => {
      const c = document.createElement('canvas')
      c.width = w as number
      c.height = h as number
      const ctx = c.getContext('2d')!
      ctx.fillStyle = left as string
      ctx.fillRect(0, 0, c.width / 2, c.height)
      ctx.fillStyle = right as string
      ctx.fillRect(c.width / 2, 0, c.width / 2, c.height)
      return c.toDataURL(type as string, quality as number | undefined).split(',')[1]!
    },
    [w, h, left, right, type, quality] as const
  )
  return Buffer.from(b64, 'base64')
}

/** EXIF (APP1) с «местом съёмки» и поворотом — сразу после SOI. */
function withExif(jpeg: Buffer, orientation: number): Buffer {
  const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0))
  const data = [
    ...ascii('Exif\0\0II'),
    42,
    0,
    8,
    0,
    0,
    0,
    2,
    0,
    0x0f,
    0x01,
    2,
    0,
    4,
    0,
    0,
    0,
    ...ascii('GPS!'),
    0x12,
    0x01,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]
  const len = data.length + 2
  return Buffer.from([
    ...jpeg.subarray(0, 2),
    0xff,
    0xe1,
    len >> 8,
    len & 0xff,
    ...data,
    ...jpeg.subarray(2),
  ])
}

/** data-URL плитки и что о ней знает браузер: размер и пиксели слева/справа. */
async function tile(composer: Locator, index: number) {
  const img = composer.getByTestId('composer-image').nth(index).locator('img')
  const src = (await img.getAttribute('src'))!
  const probe = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode()
    const c = document.createElement('canvas')
    c.width = el.naturalWidth
    c.height = el.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(el, 0, 0)
    const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data)
    return {
      w: el.naturalWidth,
      h: el.naturalHeight,
      topLeft: at(2, 2),
      bottomRight: at(c.width - 3, c.height - 3),
    }
  })
  return {
    mime: src.slice(5, src.indexOf(';')),
    bytes: Buffer.from(src.split(',')[1]!, 'base64'),
    ...probe,
  }
}

test('картинки уходят без EXIF; прозрачность не чернеет; сжатый JPEG не пережимается', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const composer = await openComposer(page)
  // Маленький уже сжатый JPEG: повторное сжатие на 0,92 сделало бы его тяжелее.
  const smallJpeg = await drawn(page, 400, 300, '#c00', '#00c', 'image/jpeg', 0.5)
  // Тот же кадр повёрнут через EXIF: на экране он стоя, 300×400.
  const rotated = await drawn(page, 400, 300, '#c00', '#00c', 'image/jpeg', 0.5)
  const files = [
    {
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: await drawn(page, 600, 300, 'rgba(0,0,0,0)', '#0a0', 'image/png'),
    },
    {
      name: 'big.png',
      mimeType: 'image/png',
      buffer: await drawn(page, 2400, 1200, '#c00', '#00c', 'image/png'),
    },
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: withExif(smallJpeg, 1) },
    { name: 'turned.jpg', mimeType: 'image/jpeg', buffer: withExif(rotated, 6) },
  ]
  await composer.locator('input[type=file][accept="image/*"]').first().setInputFiles(files)
  await expect(composer.getByTestId('composer-image')).toHaveCount(4, { timeout: 15_000 })

  // Прозрачный PNG остаётся PNG: прозрачная половина не стала чёрной.
  const logo = await tile(composer, 0)
  expect(logo.mime).toBe('image/png')
  expect(logo.topLeft[3]).toBe(0)
  expect(logo.bottomRight).toEqual([0, 170, 0, 255])

  // Большой непрозрачный — уменьшен в 1920×960 и сжат в JPEG.
  const big = await tile(composer, 1)
  expect(big.mime).toBe('image/jpeg')
  expect([big.w, big.h]).toEqual([1920, 960])

  // Маленький JPEG — тот же файл байт в байт, только без EXIF.
  const photo = await tile(composer, 2)
  expect(photo.mime).toBe('image/jpeg')
  expect(photo.bytes.includes(Buffer.from('GPS!'))).toBe(false)
  expect(photo.bytes.equals(smallJpeg)).toBe(true)

  // Повёрнутый — перерисован стоя, EXIF не ушёл: красная половина сверху.
  const turned = await tile(composer, 3)
  expect(turned.mime).toBe('image/jpeg')
  expect(turned.bytes.includes(Buffer.from('Exif'))).toBe(false)
  expect([turned.w, turned.h]).toEqual([300, 400])
  expect(turned.topLeft[0]).toBeGreaterThan(150)
  expect(turned.topLeft[2]).toBeLessThan(100)
  expect(turned.bottomRight[2]).toBeGreaterThan(150)
})
