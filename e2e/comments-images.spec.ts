import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Картинки в комментариях. «Прикрепить картинку» добавляет миниатюру, её
 * можно убрать. Отправка грузит картинку на сервер картинок (здесь — подмена)
 * и только потом собирает транзакцию. Подменная нода транзакций не принимает:
 * картинка возвращается в поле уже адресом и второй раз не грузится.
 * Картинки комментариев прежнего приложения видны в обсуждении и в превью
 * последнего комментария под постом. На телефоне форма не шире экрана.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
const ALICE = { address: 'PAmockAlice1111111111111111111111', name: 'tester_alice' }
const POST = 'f'.repeat(64)
const OLD = 'c1'.padEnd(64, '0')
/** Сервер картинок Bastyon: туда грузит и прежнее приложение. Ответы подменяются. */
const IMAGES = 'https://pocketnet.app:8092/i/'
const UPLOAD = 'https://pocketnet.app:8092/up'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)
const CORS = { 'Access-Control-Allow-Origin': '*' }

const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }, ALICE],
  posts: [
    {
      txid: POST,
      address: ALICE.address,
      message: 'Пост с картинками в обсуждении',
      comments: 2,
      lastComment: OLD,
    },
  ],
  comments: [
    { id: 'c0'.padEnd(64, '0'), postid: POST, address: ME, message: 'Текстовый комментарий' },
    // Последний — комментарий прежнего приложения из одних картинок.
    {
      id: OLD,
      postid: POST,
      address: ALICE.address,
      message: '',
      images: [`${IMAGES}old-a.png`, `${IMAGES}old-b.png`],
    },
  ],
}

/** Подмена сервера картинок: отдаёт PNG, загрузку запоминает и отвечает адресом. */
async function fakeImageServer(page: Page): Promise<string[]> {
  const uploads: string[] = []
  await page.route(`${IMAGES}**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: CORS })
  )
  await page.route(UPLOAD, async (route) => {
    uploads.push(route.request().postData() ?? '')
    await route.fulfill({
      status: 200,
      headers: CORS,
      json: { data: { ident: `up-${uploads.length}.png` } },
    })
  })
  return uploads
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await dialog.locator('input, textarea').first().fill(MNEMONIC)
  await dialog.getByRole('button', { name: 'Войти' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** На страницу поста — внутри приложения, без перезагрузки. */
async function openPost(page: Page): Promise<void> {
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    `/post/${POST}`
  )
  await expect(page.getByPlaceholder(/Введите комментарий/)).toBeVisible({ timeout: 20_000 })
}

const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG })

test.describe('на компьютере', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('прикрепить, отправить, вернуть адресом, убрать; картинки прежнего приложения', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    const uploads = await fakeImageServer(page)
    await signIn(page)

    // Превью последнего комментария в ленте: он из одних картинок — и виден.
    await expect(page.getByText('Пост с картинками в обсуждении').first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator(`img[src="${IMAGES}old-a.png"]`).first()).toBeVisible()

    await openPost(page)
    // В развёрнутом обсуждении — те же картинки у карточки комментария.
    await page.getByRole('button', { name: 'Загрузить ещё' }).first().click()
    const old = page.locator(`[data-comment-id="${OLD}"]`)
    await expect(old.locator(`img[src="${IMAGES}old-b.png"]`)).toBeVisible({ timeout: 20_000 })

    const send = page.getByRole('button', { name: 'Отправить' }).last()
    await expect(send).toBeDisabled()
    await page.getByTestId('comment-image-input').first().setInputFiles(photo('photo.png'))
    const thumbs = page.getByTestId('comment-image')
    await expect(thumbs).toHaveCount(1)
    // Комментарий из одной картинки отправить можно.
    await expect(send).toBeEnabled()
    await page.screenshot({ path: 'test-results/comments-images-desktop.png', fullPage: true })

    await send.click()
    // Картинка ушла на сервер картинок до транзакции.
    await expect.poll(() => uploads.length).toBe(1)
    expect(uploads[0]).toContain('api_key=')
    // Нода транзакцию не приняла — картинка в поле, уже адресом.
    await expect(thumbs.locator('img')).toHaveAttribute('src', `${IMAGES}up-1.png`, {
      timeout: 20_000,
    })

    // Повторная отправка не грузит её второй раз.
    await send.click()
    await expect(thumbs.locator('img')).toHaveAttribute('src', `${IMAGES}up-1.png`, {
      timeout: 20_000,
    })
    await expect(send).toBeEnabled({ timeout: 20_000 })
    expect(uploads).toHaveLength(1)

    await page.getByRole('button', { name: 'Убрать картинку' }).click()
    await expect(thumbs).toHaveCount(0)
    await expect(send).toBeDisabled()
  })
})

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 375, height: 780 }, isMobile: true, hasTouch: true })

  test('три миниатюры и кнопки под полем не шире экрана', async ({ page }) => {
    test.setTimeout(120_000)
    await useMockNode(page, DATA)
    await fakeImageServer(page)
    await signIn(page)
    await openPost(page)

    const input = page.getByTestId('comment-image-input').first()
    await input.setInputFiles([photo('a.png'), photo('b.png'), photo('c.png')])
    await expect(page.getByTestId('comment-image')).toHaveCount(3)

    const field = await page.getByPlaceholder(/Введите комментарий/).boundingBox()
    const attach = await page.getByTestId('comment-attach-image').first().boundingBox()
    const send = await page.getByRole('button', { name: 'Отправить' }).last().boundingBox()
    // Кнопки — строкой под полем: прикрепить слева, отправить справа.
    expect(attach!.y).toBeGreaterThanOrEqual(field!.y + field!.height)
    expect(send!.x).toBeGreaterThan(attach!.x)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
    await page.screenshot({ path: 'test-results/comments-images-mobile.png', fullPage: true })
  })
})
