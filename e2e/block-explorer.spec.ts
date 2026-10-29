import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke-тесты блокчейн-обозревателя.
 *
 * Стратегия: тесты используют реальные ноды Pocketnet (см. servers.json), как и
 * приложение в проде. Никаких моков сети — это «golden path» проверка, чтобы
 * убедиться, что 4 базовых маршрута действительно открываются и рендерятся.
 *
 * Если конкретная нода/RPC-метод упадёт, тест ожидаемо упадёт, и это правильно —
 * нам нужно знать, что обозреватель сломан.
 *
 * Все таймауты длинные: первая загрузка тянет код-сплит, потом ходит к ноде.
 */

async function waitForAppMount(page: Page) {
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  // Чистый профиль браузера — первый запуск: всплывает «Что нового» и
  // перекрывает страницу. Закрываем его, если появился.
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

test.describe('Block explorer routes', () => {
  test('main page renders header and search input', async ({ page }) => {
    await page.goto('/explorer')
    await waitForAppMount(page)

    // Заголовок обозревателя.
    await expect(page.getByRole('heading', { name: 'Блокчейн-обозреватель' })).toBeVisible({
      timeout: 15_000,
    })
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
    // Хлебные крошки «Блокчейн-обозреватель / Блок».
    await expect(page.getByText('Блокчейн-обозреватель').first()).toBeVisible()
    // Заголовок «Блок #1» (genesis-блок Pocketnet) — ждём загрузки данных.
    await expect(page.getByText('#1', { exact: false })).toBeVisible({ timeout: 30_000 })
  })

  test('block page loads metadata and shows tx section title', async ({ page }) => {
    await page.goto('/explorer/block/1')
    await waitForAppMount(page)

    // Metadata-карточки: Хеш блока + Высота.
    await expect(page.getByText('Хеш блока')).toBeVisible({ timeout: 30_000 })
    // У подписи рядом значок подсказки «?», поэтому точное совпадение не годится.
    await expect(page.getByText(/^Высота/).first()).toBeVisible()
    // Секция транзакций.
    await expect(page.getByText('Транзакции в блоке')).toBeVisible({ timeout: 30_000 })
  })

  test('tx route renders breadcrumb (even before data loads)', async ({ page }) => {
    // Фиктивный txid — нода вернёт пусто, страница должна показать «Транзакция не найдена».
    const fakeTxid = '0'.repeat(64)
    await page.goto(`/explorer/tx/${fakeTxid}`)
    await waitForAppMount(page)

    // Breadcrumb всегда виден.
    await expect(page.getByText('Блокчейн-обозреватель').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Транзакция').first()).toBeVisible()
  })

  test('address route renders breadcrumb and balance label', async ({ page }) => {
    test.setTimeout(60_000)
    // Адрес, с которого Bastyon платит авторам монетизацию (`a:monetization`):
    // транзакции у него есть всегда. Прежний PEbcdM5z… нода отвергает как
    // «Invalid address» — у него неверная контрольная сумма.
    const sampleAddress = 'PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5'
    await page.goto(`/explorer/address/${sampleAddress}`)
    await waitForAppMount(page)

    await expect(page.getByText('Блокчейн-обозреватель').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Баланс').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Транзакции', { exact: true }).first()).toBeVisible()
    // Список транзакций адреса не пуст: до 22.10.2026 запрос `[адрес, -1, N]`
    // нода понимала как «блоки не выше −1», и список был пустым всегда.
    await expect(page.getByRole('link', { name: /^#[\d\s\u00a0,]+$/ }).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Транзакций нет')).toHaveCount(0)
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
