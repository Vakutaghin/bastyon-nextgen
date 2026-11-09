import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Коллекции и плейлисты» на подменной ноде: вход из левой панели и из меню
 * аккаунта, встроенные списки сверху, свои плейлисты и коллекции одним
 * списком со значками «что внутри» и «кто видит», фильтры, личный список —
 * создать в окне «Создать», переименовать, сделать публичным, удалить;
 * «Избранное» по закладке. В сеть ничего не уходит: личные списки без
 * мессенджера живут на устройстве.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ME = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'

const VIDEO = '1'.repeat(64)
const TRACK = '2'.repeat(64)
const POST = '3'.repeat(64)

const DATA: MockNodeData = {
  profiles: [{ address: ME, name: 'me_ng' }],
  posts: [
    {
      txid: VIDEO,
      address: ME,
      message: '',
      caption: 'Ролик',
      type: 'video',
      url: 'peertube://peertube101.pocketnet.app/aaaaaaaa-0000-0000-0000-000000000001',
    },
    {
      txid: TRACK,
      address: ME,
      message: '',
      caption: 'Песня',
      type: 'audio',
      url: 'peertube://peertube101.pocketnet.app/bbbbbbbb-0000-0000-0000-000000000001/audio',
    },
    { txid: POST, address: ME, message: 'Просто пост', type: 'share' },
  ],
  comments: [],
  collections: [
    {
      txid: 'a'.repeat(64),
      address: ME,
      caption: 'Сезон 1',
      contentIds: [VIDEO],
      contentTypes: 201,
    },
    {
      txid: 'b'.repeat(64),
      address: ME,
      caption: 'Концерт',
      contentIds: [TRACK],
      contentTypes: 210,
    },
    { txid: 'c'.repeat(64), address: ME, caption: 'Лучшее за год', contentIds: [POST] },
  ],
}

async function openSignedIn(page: Page, path: string): Promise<void> {
  await useMockNode(page, DATA)
  await page.goto(path)
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

const row = (page: Page, text: string) => page.getByTestId('shelf-row').filter({ hasText: text })

test('всё своё на одной странице: встроенные сверху, один список со значками, фильтры', async ({
  page,
}) => {
  await openSignedIn(page, '/')
  await page.getByRole('button', { name: 'Коллекции', exact: true }).click()
  await expect(page).toHaveURL(/\/collections$/)

  await expect(page.getByTestId('shelf-builtin-favorites')).toContainText('Избранное')
  await expect(page.getByTestId('shelf-builtin-later')).toContainText('Смотреть позже')

  await expect(row(page, 'Сезон 1')).toContainText('1 видео')
  await expect(row(page, 'Сезон 1').getByTestId('shelf-row-visibility')).toHaveText('Видят все')
  await expect(row(page, 'Концерт')).toContainText('1 трек')
  await expect(row(page, 'Лучшее за год')).toContainText('1 публикация')
  await expect(page.getByTestId('my-collections')).not.toContainText(/альбом/i)

  await page.getByTestId('shelf-filter-audio').click()
  await expect(page.getByTestId('shelf-row')).toHaveCount(1)
  await expect(page.getByTestId('shelf-row')).toContainText('Концерт')

  await page.getByTestId('shelf-filter-all').click()
  await row(page, 'Сезон 1').getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/collection/${'a'.repeat(64)}$`))
})

test('меню аккаунта ведёт на страницу; ссылка есть на вкладке «Плейлисты»', async ({ page }) => {
  await openSignedIn(page, '/video/playlists')
  await page.getByTestId('shelf-link').click()
  await expect(page).toHaveURL(/\/collections$/)
  await page.goto('/')
  await page.locator('[data-header-avatar]').click()
  await page.getByRole('menuitem', { name: 'Коллекции и плейлисты' }).click()
  await expect(page).toHaveURL(/\/collections$/)
})

test('вход прямо на странице: свои коллекции появляются, а не висят на «Загружаем…»', async ({
  page,
}) => {
  await openSignedIn(page, '/collections')
  await expect(row(page, 'Сезон 1')).toBeVisible({ timeout: 15_000 })
  await expect(row(page, 'Лучшее за год')).toBeVisible()
})

test('личный список: окно «Создать», переименовать, «Сделать публичным», удалить', async ({
  page,
}) => {
  await openSignedIn(page, '/collections')
  await page.getByTestId('shelf-create').click()
  const editor = page.getByTestId('collection-editor')
  await expect(editor).toBeVisible()
  await expect(page.getByTestId('list-visibility-private')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('list-kind-posts').click()
  await page.getByTestId('collection-caption').fill('Поездки')
  await page.getByTestId('collection-save').click()
  // Личный создаётся сразу и открывается.
  await expect(page).toHaveURL(/\/library\/p:/)
  await expect(page.getByRole('heading', { name: 'Поездки' })).toBeVisible()

  await page.getByRole('link', { name: /Коллекции и плейлисты/ }).click()
  await expect(row(page, 'Поездки')).toContainText('0 публикаций')
  await expect(row(page, 'Поездки').getByTestId('shelf-row-visibility')).toHaveText('Только я')

  await row(page, 'Поездки').getByTestId('shelf-row-menu').click()
  await page.getByRole('menuitem', { name: 'Переименовать' }).click()
  await page.getByTestId('shelf-name').fill('Поездки 2026')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
  const renamed = row(page, 'Поездки 2026')
  await expect(renamed).toBeVisible()

  // «Сделать публичным» — то же окно, «Кто видит» уже выбран, название на месте.
  await renamed.getByTestId('shelf-row-menu').click()
  await page.getByRole('menuitem', { name: 'Сделать публичным' }).click()
  await expect(page.getByRole('dialog', { name: /Сделать список публичным/ })).toBeVisible()
  await expect(page.getByTestId('collection-caption')).toHaveValue('Поездки 2026')
  await expect(page.getByTestId('list-visibility-public')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()

  await renamed.getByTestId('shelf-row-menu').click()
  await page.getByRole('menuitem', { name: 'Удалить' }).click()
  const confirm = page.getByRole('dialog').filter({ hasText: 'Удалить «Поездки 2026»?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Удалить' }).click()
  await expect(renamed).toHaveCount(0)
})

test('«Избранное»: закладка на посте — в плитке страницы и в ленте «Избранное»', async ({
  page,
}) => {
  await openSignedIn(page, `/post/${POST}`)
  const bookmark = page.getByTestId('post-bookmark').first()
  await bookmark.click()
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/collections')
  const tile = page.getByTestId('shelf-builtin-favorites')
  await expect(tile).toContainText('1')
  await tile.getByRole('link').click()
  await expect(page).toHaveURL(/feedMode=favorites/)
  await expect(page.getByText('Просто пост')).toBeVisible({ timeout: 15_000 })
})
