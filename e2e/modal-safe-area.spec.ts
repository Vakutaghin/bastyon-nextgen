import { test, expect, type Page } from '@playwright/test'
import { useMockNode, type MockNodeData } from './support/mock-node'
import { settleOfflineMessenger } from './support/offline-messenger'

/**
 * Окна и системные полосы телефона. На Android приложение рисуется под
 * строкой состояния и кнопками навигации, их высоту MainActivity передаёт в
 * --android-inset-*. Высокое окно не заходит под полосы: заголовок — под
 * строкой состояния, кнопки внизу — над кнопками навигации (жалоба 11.11:
 * «Отмена» и «Отправить» в окне «Сведения о приложении» лежали под ними).
 * Окно поста во весь экран долистывается до конца над кнопками навигации.
 */

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const SUPP = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const mx = (address: string) => `@${Buffer.from(address).toString('hex')}:matrix.pocketnet.app`
const DM = '!dm:matrix.pocketnet.app'
const POST = 'b'.repeat(64)
const LAST_LINE = 'Последняя строка длинного поста.'

const DATA: MockNodeData = {
  profiles: [{ address: SUPP, name: 'bastyon_nextgen_supp' }],
  posts: [
    {
      txid: POST,
      address: SUPP,
      message: [
        ...Array.from({ length: 60 }, (_, i) => `Строка длинного поста номер ${i + 1}.`),
        LAST_LINE,
      ].join('\n'),
    },
  ],
  comments: [],
}

const HEIGHT = 800
const STATUS_BAR = 24
const NAV_BAR = 48

type Stores = Map<string, Record<string, unknown>>
type Box = { wrapScroll: number; top: number; bottom: number }

test.use({ viewport: { width: 360, height: HEIGHT }, hasTouch: true })
test.describe.configure({ timeout: 120_000 })

async function open(page: Page): Promise<void> {
  // Адрес поддержки — как запомненный с прошлого запуска.
  await page.addInitScript((address) => {
    localStorage.setItem('bastyon_support_address', address)
  }, SUPP)
  await page.route('**/_matrix/**', (route) => route.abort())
  await useMockNode(page, DATA)
  await page.goto('/')
  await page.waitForSelector('#app > *', { timeout: 30_000 })
  await page
    .getByRole('button', { name: 'Понятно' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  // Полосы, как их передаёт MainActivity.
  await page.evaluate(
    ({ top, bottom }) => {
      const style = document.documentElement.style
      style.setProperty('--android-inset-top', `${top}px`)
      style.setProperty('--android-inset-bottom', `${bottom}px`)
    },
    { top: STATUS_BAR, bottom: NAV_BAR }
  )
}

/** Прокрутить обёртку окна к началу или к концу и снять, где окно на экране. */
async function scrollModal(page: Page, end: 'top' | 'bottom'): Promise<Box> {
  return page.evaluate((to) => {
    const content = document.querySelector<HTMLElement>('.ant-modal-wrap .ant-modal-content')!
    const wrap = content.closest<HTMLElement>('.ant-modal-wrap')!
    wrap.scrollTop = to === 'top' ? 0 : wrap.scrollHeight
    const rect = content.getBoundingClientRect()
    return { wrapScroll: wrap.scrollHeight - wrap.clientHeight, top: rect.top, bottom: rect.bottom }
  }, end)
}

test('«Сведения о приложении»: окно между строкой состояния и кнопками навигации', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Войти' }).first().click()
  const login = page.getByRole('dialog', { name: 'Вход в аккаунт' })
  await login.locator('input, textarea').first().fill(MNEMONIC)
  await login.getByRole('button', { name: 'Войти' }).click()
  await expect(login).toBeHidden({ timeout: 30_000 })
  await settleOfflineMessenger(page, DATA.profiles)
  await page.getByRole('navigation').getByRole('button', { name: 'Чаты', exact: true }).click()

  // Чат с поддержкой. Сервер чатов закрыт: комнаты нет, собеседника по ней
  // не узнать — его адрес отдаёт подменённая функция стора.
  await page.evaluate(
    ({ dm, partner, address }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const ui = stores.get('messenger-ui') as Record<string, unknown> & {
        setDialogs: (d: unknown) => void
        switchToChat: (id: string) => void
      }
      const chat = stores.get('messenger-chat') as {
        messages: Record<string, unknown[]>
        history: Record<string, unknown>
      }
      chat.messages[dm] = []
      chat.history[dm] = { reachedStart: true }
      ;(stores.get('messenger') as Record<string, unknown>).getDirectPartnerAddress = () => address
      ui.setDialogs([
        {
          id: dm,
          partner: { id: partner, name: 'bastyon_nextgen_supp' },
          unreadCount: 0,
          createdAt: Date.now() - 3_600_000,
        },
      ])
      ui.isFullScreen = true
      ui.switchToChat(dm)
    },
    { dm: DM, partner: mx(SUPP), address: SUPP }
  )

  await page.getByRole('button', { name: 'Отправить сведения о приложении' }).click()
  const dialog = page.getByRole('dialog', { name: 'Отправить сведения о приложении?' })
  await expect(dialog.locator('pre')).toBeVisible({ timeout: 15_000 })
  const send = dialog.getByRole('button', { name: 'Отправить' })
  await expect(send).toBeVisible()

  // Окно выше экрана — прокручивается целиком.
  await expect
    .poll(async () => (await scrollModal(page, 'top')).top)
    .toBeGreaterThanOrEqual(STATUS_BAR)
  expect((await scrollModal(page, 'top')).wrapScroll).toBeGreaterThan(0)
  const end = await scrollModal(page, 'bottom')
  expect(end.bottom).toBeLessThanOrEqual(HEIGHT - NAV_BAR)
  const button = await send.boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual(HEIGHT - NAV_BAR)
})

test('окно поста во весь экран долистывается над кнопками навигации', async ({ page }) => {
  await open(page)
  await page.locator('.post-card').first().getByTestId('post-time-link').click()
  const modal = page.locator('.ant-modal.post-modal')
  await expect(modal.getByText(LAST_LINE)).toBeAttached({ timeout: 15_000 })

  // Окно — во весь экран, как и было: полей под полосы у него нет. Окно
  // вырастает анимацией — замер после неё.
  await expect.poll(async () => (await scrollModal(page, 'top')).top).toBe(0)
  const box = await scrollModal(page, 'top')
  expect(box.bottom).toBe(HEIGHT)
  expect(box.wrapScroll).toBe(0)

  // Долистано до конца: низ содержимого (под постом — кнопки и комментарии).
  const contentEnd = await modal.locator('.ant-modal-body').evaluate((body) => {
    body.scrollTop = body.scrollHeight
    return Math.max(...[...body.children].map((child) => child.getBoundingClientRect().bottom))
  })
  expect(contentEnd).toBeLessThanOrEqual(HEIGHT - NAV_BAR)
})
