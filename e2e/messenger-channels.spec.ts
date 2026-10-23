import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * Каналы в мессенджере: «Читать в мессенджере» в профиле автора, канал в
 * списке рядом с чатами, лента постов, фильтр «Все / Переписки / Каналы»,
 * который помнится и общий у окошка и полноэкранного мессенджера. Сервер
 * чатов не нужен: каналы — посты с ноды (подменной).
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const HOUR = 3600

const DATA: MockNodeData = {
  profiles: [
    { address: ALICE, name: 'alice_ng' },
    { address: BOB, name: 'bob_ng' },
  ],
  posts: [
    { txid: 'a'.repeat(64), address: ALICE, message: 'Первый пост Алисы', ago: 72 * HOUR },
    {
      txid: 'b'.repeat(64),
      address: ALICE,
      caption: 'Заголовок второго',
      message: 'Текст второго поста',
      ago: 2 * HOUR,
      comments: 3,
    },
    { txid: 'c'.repeat(64), address: ALICE, message: 'Свежий пост Алисы', ago: 600 },
    { txid: 'd'.repeat(64), address: BOB, message: 'Пост Боба', ago: 300 },
  ],
  comments: [],
}

async function signIn(page: Page): Promise<void> {
  await useMockNode(page, DATA)
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

/** Действие стора pinia — то, что в приложении делает кнопка, до которой тесту долго идти. */
async function callStore(page: Page, id: string, action: string, ...args: unknown[]) {
  await page.evaluate(
    async ([storeId, name, params]) => {
      type Store = Record<string, (...a: unknown[]) => unknown>
      const app = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
        }
      ).__vue_app__
      await app.config.globalProperties.$pinia._s.get(storeId as string)![name as string]!(
        ...(params as unknown[])
      )
    },
    [id, action, args] as const
  )
}

async function readAliceInMessenger(page: Page): Promise<void> {
  await page.goto(`/${ALICE}`)
  // Кнопка и в боковой колонке (компьютер), и в шапке профиля (телефон) — видна одна.
  const read = page.getByTestId('profile-channel').filter({ visible: true })
  await expect(read).toHaveText('Читать в мессенджере', { timeout: 30_000 })
  await read.click()
  await expect(page.getByText('Публикации alice_ng теперь в мессенджере')).toBeVisible()
  await expect(read).toHaveText('Открыть в мессенджере')
  await expect(page.getByTestId('profile-channel-stop').filter({ visible: true })).toBeVisible()
}

/** Лента канала alice_ng: только её посты, старые сверху, свежий внизу. */
async function checkChannelFeed(page: Page): Promise<void> {
  const title = page.getByTestId('channel-title').last()
  await expect(title).toContainText('alice_ng', { timeout: 30_000 })
  await expect(title).toContainText('Канал')
  const posts = page.getByTestId('channel-post')
  await expect(posts).toHaveCount(3, { timeout: 30_000 })
  await expect(posts.first()).toContainText('Первый пост Алисы')
  await expect(posts.nth(1)).toContainText('Заголовок второго')
  await expect(posts.nth(1)).toContainText('Текст второго поста')
  await expect(posts.last()).toContainText('Свежий пост Алисы')
  await expect(page.getByText('Пост Боба')).toHaveCount(0)
  // Подписи дней: свежий пост — сегодня (сразу после полуночи — вчера).
  await expect(page.getByText(/^(Сегодня|Вчера)$/).first()).toBeVisible()
  // Вместо поля ввода — подписка и личное сообщение автору.
  await expect(page.getByTestId('channel-subscribe')).toBeVisible()
  await expect(page.getByTestId('channel-write')).toHaveText('Написать автору')
  // Свежий пост в зоне видимости: лента открылась внизу.
  await expect(posts.last()).toBeInViewport()
}

/** Пост открывается целиком в окне поста, и оно поверх мессенджера. */
async function openPostOnTop(page: Page): Promise<void> {
  await page.getByTestId('channel-post').last().click()
  const modal = page.locator('.ant-modal-content').filter({ hasText: 'Свежий пост Алисы' })
  await expect(modal).toBeVisible({ timeout: 15_000 })
  const onTop = await modal.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 40)
    return !!hit && el.contains(hit)
  })
  expect(onTop).toBe(true)
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
}

test('профиль → «Читать в мессенджере» → канал в списке, лента, фильтр помнится', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signIn(page)
  await readAliceInMessenger(page)

  await page.getByTestId('profile-channel').filter({ visible: true }).click()
  await checkChannelFeed(page)
  await openPostOnTop(page)

  // Назад к списку: канал отличим от чатов — мегафон, «Канал», последний пост.
  await page.keyboard.press('Escape')
  const row = page.locator('[data-testid=chat-row][data-channel]')
  await expect(row).toBeVisible()
  await expect(row.getByLabel('Канал', { exact: true })).toBeVisible()
  await expect(row).toContainText('alice_ng')
  await expect(row).toContainText('Свежий пост Алисы')

  // Фильтр: каналы отдельно, переписок нет — подсказка.
  await page.getByRole('radio', { name: 'Переписки' }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByText('Переписок пока нет')).toBeVisible()
  await page.getByRole('radio', { name: /Каналы/ }).click()
  await expect(row).toBeVisible()

  // После перезапуска — тот же канал (кнопка в профиле его помнит) и тот же фильтр.
  await page.reload()
  const open = page.getByTestId('profile-channel').filter({ visible: true })
  await expect(open).toHaveText('Открыть в мессенджере', { timeout: 30_000 })
  await open.click()
  await expect(page.getByTestId('channel-post').last()).toContainText('Свежий пост Алисы', {
    timeout: 30_000,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('radio', { name: /Каналы/ })).toHaveAttribute(
    'aria-checked',
    'true',
    {
      timeout: 30_000,
    }
  )
  await expect(row).toBeVisible()

  // Полноэкранный мессенджер (узкое окно) — с тем же фильтром.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('radio', { name: /Каналы/ })).toHaveAttribute('aria-checked', 'true')
  await expect(row).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })

  // «Не читать в мессенджере» из меню строки — канал уходит, вернуть можно тостом.
  await row.locator('.dots-btn').click()
  await page.getByText('Не читать в мессенджере').click()
  await expect(row).toHaveCount(0)
  await expect(page.getByText('Каналов пока нет')).toBeVisible()
  await page.getByText('alice_ng больше не в мессенджере').click()
  await expect(row).toBeVisible()
})

test('новые публикации: счётчик в списке и черта в ленте', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page)
  await readAliceInMessenger(page)
  // Прочитано три часа назад: два поста после — новые.
  await page.evaluate((address) => {
    type Store = { $patch: (p: unknown) => void; summaries: Record<string, { checkedAt: number }> }
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, Store> } } } }
      }
    ).__vue_app__
    const channels = app.config.globalProperties.$pinia._s.get('messenger-channels')!
    channels.$patch({
      doc: {
        v: 1,
        items: { [address]: { on: true, t: Date.now(), seen: Date.now() - 3 * 3600_000 } },
      },
    })
  }, ALICE)
  await callStore(page, 'messenger', 'openMessenger')

  const row = page.locator('[data-testid=chat-row][data-channel]')
  await expect(row.getByLabel('2 новые публикации')).toHaveText('2', { timeout: 30_000 })
  // В «Переписках» видно, что в каналах есть новое.
  await page.getByRole('radio', { name: 'Переписки' }).click()
  await expect(page.getByRole('radio', { name: /Каналы/ })).toContainText('1')
  await page.getByRole('radio', { name: 'Все' }).click()

  await row.click()
  const divider = page.getByTestId('channel-new-divider')
  await expect(divider).toBeVisible({ timeout: 30_000 })
  // Черта — перед первым непрочитанным, вторым постом.
  const after = divider.locator('xpath=following-sibling::*[@data-testid="channel-post"][1]')
  await expect(after).toContainText('Заголовок второго')

  // Открыли — прочитано.
  await page.keyboard.press('Escape')
  await expect(row).toBeVisible()
  await expect(row.getByLabel(/новые публикации/)).toHaveCount(0)
})

test.describe('на телефоне', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('канал во весь экран, пост поверх, страница не уезжает вбок', async ({ page }) => {
    test.setTimeout(120_000)
    await signIn(page)
    await readAliceInMessenger(page)
    await page.getByTestId('profile-channel').filter({ visible: true }).click()
    await checkChannelFeed(page)
    await openPostOnTop(page)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
  })
})
