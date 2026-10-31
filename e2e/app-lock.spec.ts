import { test, expect, type Locator, type Page } from '@playwright/test'
import { useMockNode } from './support/mock-node'

/**
 * Замок приложения в настоящем движке (Chromium и WebKit — как WKWebView и
 * WebKitGTK): пин-код с клавиатуры компьютера, графический ключ мышью,
 * Ctrl+L, закрыто после перезапуска, «Забыли?» по 12 словам. Под замком
 * приложение inert. Сейф — настоящий, на IndexedDB.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

async function signInAndOpenSecurity(page: Page): Promise<void> {
  await useMockNode(page, { profiles: [], posts: [] })
  // Сервер чатов не нужен: без этого вход ушёл бы в боевой Matrix через прокси Vite.
  await page.route('**/_matrix/**', (route) => route.abort())
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
  await page.goto('/settings?tab=privateKey')
  await expect(page.getByText('Вход в приложение')).toBeVisible({ timeout: 20_000 })
}

const lockScreen = (page: Page, name: string): Locator =>
  page.getByRole('dialog', { name, exact: true })

/** Провести ключ мышью по точкам 0–8 поля. */
async function draw(page: Page, grid: Locator, dots: number[]): Promise<void> {
  const box = (await grid.boundingBox())!
  const at = (d: number) => ({
    x: box.x + (box.width * ((d % 3) + 0.5)) / 3,
    y: box.y + (box.height * (Math.floor(d / 3) + 0.5)) / 3,
  })
  const first = at(dots[0]!)
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (const d of dots.slice(1)) {
    const p = at(d)
    await page.mouse.move(p.x, p.y, { steps: 6 })
  }
  await page.mouse.up()
}

test.describe('Замок приложения', () => {
  test.describe.configure({ mode: 'serial' })

  test('пин-код: задать, Ctrl+L, неверный и верный, закрыто после перезапуска', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await signInAndOpenSecurity(page)

    await page.getByRole('button', { name: 'Задать пин-код' }).click()
    const setup = page.getByRole('dialog', { name: 'Задать пин-код' })
    await expect(setup.getByText('Придумайте пин-код')).toBeVisible()
    await page.keyboard.type('2580')
    await expect(setup.getByText('Повторите пин-код')).toBeVisible()
    await page.keyboard.type('2580')
    await expect(page.getByText('Пин-код задан.')).toBeVisible()
    await expect(setup).toBeHidden()
    await expect(page.getByText('Вход по пин-коду из 4 цифр.')).toBeVisible()

    await page.keyboard.press('Control+L')
    const lock = lockScreen(page, 'Введите пин-код')
    await expect(lock).toBeVisible()
    // Под замком приложение не ловит ни фокус, ни нажатия.
    await expect(page.locator('#app')).toHaveAttribute('inert', '')

    await page.keyboard.type('1111')
    await expect(lock.getByText('Неверный пин-код')).toBeVisible()
    await page.waitForTimeout(600)
    // Касанием, как на телефоне: клавиши экрана.
    for (const d of '2580') await lock.getByRole('button', { name: d, exact: true }).click()
    await expect(lock).toBeHidden()
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '')

    await page.reload()
    await expect(lockScreen(page, 'Введите пин-код')).toBeVisible({ timeout: 30_000 })
    await page.keyboard.type('2580')
    await expect(lockScreen(page, 'Введите пин-код')).toBeHidden()
    await expect(page.getByText('Вход в приложение')).toBeVisible()
  })

  test('графический ключ: задать мышью, неверный не пускает, «Забыли?» по 12 словам', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await signInAndOpenSecurity(page)

    await page.getByRole('button', { name: 'Задать графический ключ' }).click()
    const setup = page.getByRole('dialog', { name: 'Задать графический ключ' })
    const setupGrid = setup.getByRole('img', { name: 'Поле графического ключа: соедините точки' })
    // Короче четырёх точек — не принимается.
    await draw(page, setupGrid, [0, 1, 2])
    await expect(setup.getByText('Соедините хотя бы 4 точки')).toBeVisible()
    await page.waitForTimeout(700)
    // Г через 0→2→8: точки 1 и 5 линия соединяет сама.
    await draw(page, setupGrid, [0, 2, 8])
    await expect(setup.getByText('Нарисуйте ключ ещё раз')).toBeVisible()
    await page.waitForTimeout(300)
    await draw(page, setupGrid, [0, 1, 2, 5, 8])
    await expect(page.getByText('Графический ключ задан.')).toBeVisible()
    await expect(page.getByText('Вход по графическому ключу.')).toBeVisible()

    await page.getByRole('button', { name: 'Заблокировать сейчас' }).click()
    const lock = lockScreen(page, 'Нарисуйте графический ключ')
    await expect(lock).toBeVisible()
    const grid = lock.getByRole('img', { name: 'Поле графического ключа: соедините точки' })
    await draw(page, grid, [0, 3, 6, 7])
    await expect(lock.getByText('Неверный графический ключ')).toBeVisible()
    await page.waitForTimeout(700)
    await draw(page, grid, [0, 2, 8])
    await expect(lock).toBeHidden()

    await page.keyboard.press('Control+L')
    await expect(lock).toBeVisible()
    await lock.getByRole('button', { name: 'Забыли графический ключ?' }).click()
    await lock.locator('textarea').fill('слово '.repeat(12))
    await lock.getByRole('button', { name: 'Снять код' }).click()
    await expect(lock.getByText('Это не фраза из 12 слов и не приватный ключ.')).toBeVisible()
    await lock.locator('textarea').fill(MNEMONIC)
    await lock.getByRole('button', { name: 'Снять код' }).click()
    await expect(lock).toBeHidden({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Задать пин-код' })).toBeVisible()
  })
})
