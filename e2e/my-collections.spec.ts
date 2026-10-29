import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'

/**
 * «Коллекции и плейлисты» на подменной ноде: вход из левой панели и из меню
 * аккаунта, свои коллекции и плейлисты по группам, личные списки, фильтр,
 * личный плейлист — создать, переименовать, удалить. В сеть ничего не уходит:
 * личные списки без мессенджера живут на устройстве.
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
      caption: 'Альбом',
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

const group = (page: Page, id: string) => page.getByTestId(`shelf-group-${id}`)

test('всё своё на одной странице: вход из левой панели, группы, фильтр', async ({ page }) => {
  await openSignedIn(page, '/')
  await page.getByRole('button', { name: 'Коллекции', exact: true }).click()
  await expect(page).toHaveURL(/\/collections$/)

  await expect(group(page, 'video')).toContainText('Сезон 1')
  await expect(group(page, 'audio')).toContainText('Альбом')
  await expect(group(page, 'posts')).toContainText('Лучшее за год')
  await expect(group(page, 'private')).toContainText('Сохранённые видео')
  await expect(group(page, 'private')).toContainText('Моя музыка')

  await page.getByTestId('shelf-filter-audio').click()
  await expect(page.getByTestId('shelf-row')).toHaveCount(1)
  await expect(page.getByTestId('shelf-row')).toContainText('Альбом')

  await page.getByTestId('shelf-filter-all').click()
  await page.getByTestId('shelf-row').filter({ hasText: 'Сезон 1' }).getByRole('link').click()
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
  await expect(group(page, 'video')).toContainText('Сезон 1', { timeout: 15_000 })
  await expect(group(page, 'posts')).toContainText('Лучшее за год')
})

test('личный плейлист: создать, переименовать, удалить с подтверждением', async ({ page }) => {
  await openSignedIn(page, '/collections')
  await page.getByTestId('shelf-create').click()
  await page.getByRole('menuitem', { name: 'Личный плейлист видео' }).click()
  await page.getByTestId('shelf-name').fill('Поездки')
  await page.getByRole('dialog').getByRole('button', { name: 'Создать' }).click()
  const row = page.getByTestId('shelf-row').filter({ hasText: 'Поездки' })
  await expect(row).toContainText('Личный плейлист · 0 видео')

  await row.getByTestId('shelf-row-menu').click()
  await page.getByRole('menuitem', { name: 'Переименовать' }).click()
  await page.getByTestId('shelf-name').fill('Поездки 2026')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
  const renamed = page.getByTestId('shelf-row').filter({ hasText: 'Поездки 2026' })
  await expect(renamed).toBeVisible()

  await renamed.getByTestId('shelf-row-menu').click()
  await page.getByRole('menuitem', { name: 'Удалить' }).click()
  const confirm = page.getByRole('dialog').filter({ hasText: 'Удалить личный плейлист' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Удалить' }).click()
  await expect(renamed).toHaveCount(0)
})
