import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke-тесты блок-эксплорера.
 *
 * Стратегия: тесты используют реальные ноды Pocketnet (см. servers.json), как и
 * приложение в проде. Никаких моков сети — это «golden path» проверка, чтобы
 * убедиться, что 4 базовых маршрута действительно открываются и рендерятся.
 *
 * Если конкретная нода/RPC-метод упадёт, тест ожидаемо упадёт, и это правильно —
 * нам нужно знать, что эксплорер сломан.
 *
 * Все таймауты длинные: первая загрузка тянет код-сплит, потом ходит к ноде.
 */

async function waitForAppMount(page: Page) {
  await page.waitForSelector('#app > *', { timeout: 30_000 })
}

test.describe('Block explorer routes', () => {
  test('main page renders header and search input', async ({ page }) => {
    await page.goto('/explorer')
    await waitForAppMount(page)

    // Заголовок эксплорера.
    await expect(page.getByText('Блок-эксплорер Pocketnet')).toBeVisible({ timeout: 15_000 })
    // Поле поиска.
    const search = page.getByPlaceholder('Хеш блока, txid, адрес или высота')
    await expect(search).toBeVisible()
    // Кнопка «Открыть».
    await expect(page.getByRole('button', { name: 'Открыть' })).toBeVisible()
    // Секция «Последние блоки».
    await expect(page.getByText('Последние блоки')).toBeVisible()
  })

  test('search by block height navigates to /explorer/block/<n>', async ({ page }) => {
    await page.goto('/explorer')
    await waitForAppMount(page)

    const search = page.getByPlaceholder('Хеш блока, txid, адрес или высота')
    await search.fill('1')
    // Локальный детектор подсветит «Блок» в hint.
    await expect(page.getByText('Блок', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Открыть' }).click()

    await page.waitForURL(/\/explorer\/block\/1$/, { timeout: 15_000 })
    // Breadcrumb «Эксплорер / Блок».
    await expect(page.getByText('Эксплорер').first()).toBeVisible()
    // Заголовок «Блок #1» (genesis-блок Pocketnet) — ждём загрузки данных.
    await expect(page.getByText('#1', { exact: false })).toBeVisible({ timeout: 30_000 })
  })

  test('block page loads metadata and shows tx section title', async ({ page }) => {
    await page.goto('/explorer/block/1')
    await waitForAppMount(page)

    // Metadata-карточки: Хеш блока + Высота.
    await expect(page.getByText('Хеш блока')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Высота', { exact: true })).toBeVisible()
    // Секция транзакций.
    await expect(page.getByText('Транзакции в блоке')).toBeVisible({ timeout: 30_000 })
  })

  test('tx route renders breadcrumb (even before data loads)', async ({ page }) => {
    // Фиктивный txid — нода вернёт пусто, страница должна показать «Транзакция не найдена».
    const fakeTxid = '0'.repeat(64)
    await page.goto(`/explorer/tx/${fakeTxid}`)
    await waitForAppMount(page)

    // Breadcrumb всегда виден.
    await expect(page.getByText('Эксплорер').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Транзакция').first()).toBeVisible()
  })

  test('address route renders breadcrumb and balance label', async ({ page }) => {
    // Используем известный адрес из главного фонда Pocketnet (большой баланс) —
    // он же используется в эталонном эксплорере. Если адрес сменится, тест надо обновить.
    const sampleAddress = 'PEbcdM5z3ggptkbptqDtgxqRcDR2GnUuJ4'
    await page.goto(`/explorer/address/${sampleAddress}`)
    await waitForAppMount(page)

    await expect(page.getByText('Эксплорер').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Баланс').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Транзакции', { exact: true }).first()).toBeVisible()
  })

  test('explorer search input keeps local hint for known formats', async ({ page }) => {
    await page.goto('/explorer')
    await waitForAppMount(page)

    const search = page.getByPlaceholder('Хеш блока, txid, адрес или высота')

    // Адрес (формат Pocketnet — base58 ~34 символа).
    await search.fill('PEbcdM5z3ggptkbptqDtgxqRcDR2GnUuJ4')
    await expect(page.getByText('Адрес', { exact: true }).first()).toBeVisible()

    // Хеш-формат (64 hex).
    await search.fill('0'.repeat(64))
    await expect(page.getByText('Хеш', { exact: true })).toBeVisible()
  })
})
