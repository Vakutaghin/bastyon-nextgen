import { test, expect, type Page } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Выход из мини-приложения. Страница мини-приложения всегда прячет шапку
 * Bastyon, а кнопка закрытия была только у открывшегося приложения: на
 * «Мини-приложение не найдено» (и «заблокировано под Tor») выйти было нечем,
 * кроме «Назад». Теперь лепесток «Закрыть» есть всегда; первые секунды он
 * раскрыт с подписью, потом остаётся «язычок». Закрытие ведёт туда, откуда
 * пришли.
 */

test.use({ viewport: { width: 1366, height: 800 } })

async function start(page: Page, path: string): Promise<void> {
  await useMockNode(page, { profiles: [], posts: [], comments: [] })
  await page.goto(path)
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
}

async function go(page: Page, path: string): Promise<void> {
  await page.evaluate(
    (p) =>
      (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $router: { push(p: string): void } } } }
        }
      ).__vue_app__.config.globalProperties.$router.push(p),
    path
  )
}

/** Подпись лепестка целиком в окне — он раскрыт. */
async function labelInView(page: Page): Promise<boolean> {
  const label = page.getByTestId('miniapp-close').getByText('Закрыть')
  const box = await label.boundingBox()
  return !!box && box.x + box.width <= 1366
}

test('«не найдено»: лепесток «Закрыть» есть и возвращает туда, откуда пришли', async ({ page }) => {
  await start(page, '/miniapps')
  await go(page, '/app/no.such.app')
  await expect(page.getByText('Мини-приложение не найдено.')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#application header')).toBeHidden()

  const close = page.getByTestId('miniapp-close')
  await expect(close).toBeVisible()
  await expect.poll(() => labelInView(page)).toBe(true)

  // Приложения нет — закрывается без вопроса «Закрыть?».
  await close.click()
  await expect(page).toHaveURL(/\/miniapps$/)
  await expect(page.locator('#application header')).toBeVisible()
})

test('открыли по ссылке — закрытие ведёт на ленту; подпись прячется через несколько секунд', async ({
  page,
}) => {
  await start(page, '/app/no.such.app')
  const close = page.getByTestId('miniapp-close')
  await expect(close).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => labelInView(page), { timeout: 10_000 }).toBe(false)

  await close.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('#application header')).toBeVisible()
})
