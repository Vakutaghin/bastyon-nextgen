import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { newAccounts, openChatWith, send, signedIn, type Account } from './support/live-matrix'

/**
 * Приватность в чатах вживую, на своём Synapse (с включённым присутствием):
 * «печатает» и «записывает голосовое» видит собеседник, пока они не выключены
 * в «Настройки» → «Чаты»; «в сети» — только когда статусом делятся оба.
 * Запись — настоящей кнопкой с подставным микрофоном Chromium. Запуск — как
 * matrix-receipts.live (в homeserver.yaml `presence: {enabled: true}`).
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({
  baseURL: BASE,
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

function profiles(alice: Account, bob: Account): MockNodeData {
  return {
    profiles: [
      { address: alice.address, name: 'alice_e2e', k: alice.keys },
      { address: bob.address, name: 'bob_e2e', k: bob.keys },
    ],
    posts: [],
    comments: [],
  }
}

/** Переход внутри приложения — без перезагрузки и перевхода в Matrix. */
async function routerPush(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
        }
      }
    ).__vue_app__
    await app.config.globalProperties.$router.push(to)
  }, path)
}

/** Переключатель в «Настройки» → «Чаты» → «Приватность»; окно чата остаётся открытым. */
async function setPrivacy(page: Page, key: string, on: boolean): Promise<void> {
  const back = new URL(page.url()).pathname
  await routerPush(page, '/settings')
  // Вкладка настроек — последняя «Чаты» на странице: первая в шапке открывает мессенджер.
  await page.getByRole('button', { name: 'Чаты', exact: true }).last().click()
  const toggle = page.getByTestId(`privacy-${key}`)
  await expect(toggle).toBeVisible()
  // С клавиатуры: окно чата в углу может закрывать переключатель от мыши.
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) {
    await toggle.focus()
    await page.keyboard.press('Space')
  }
  await expect(toggle).toHaveAttribute('aria-checked', String(on))
  await routerPush(page, back)
}

test('«печатает», «записывает голосовое» и «в сети» — по настройкам', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'подставной микрофон — только у Chromium')
  test.setTimeout(300_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data = profiles(alice!, bob!)
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)
  await a.context().grantPermissions(['microphone'])

  await openChatWith(a, bob!, true)
  await send(a, 'привет')
  await openChatWith(b, alice!, false)
  await expect(b.getByText('привет')).toBeVisible({ timeout: 60_000 })

  const input = a.getByPlaceholder('Введите сообщение...')
  const typing = b.getByText(/печатает…/)
  const recording = b.getByTestId('recording-indicator')
  const presence = b.getByTestId('partner-presence')

  // «Печатает» — по умолчанию да.
  await input.fill('пишу ответ')
  await expect(typing).toBeVisible({ timeout: 15_000 })
  await input.fill('')

  // Голосовое: держим кнопку — у собеседника «записывает», отпустили — гаснет.
  const mic = a.getByRole('button', { name: 'Записать голосовое сообщение' })
  await mic.hover()
  await a.mouse.down()
  await expect(recording).toContainText('записывает голосовое…', { timeout: 15_000 })
  await a.waitForTimeout(1500)
  await a.mouse.up()
  await expect(recording).toBeHidden({ timeout: 15_000 })

  // «В сети» по умолчанию не сообщаем — и статуса собеседника не видно.
  await expect(presence).toHaveCount(0)

  // Выключили «печатает» и «записывает» — собеседник ничего не видит.
  await setPrivacy(a, 'typing', false)
  await setPrivacy(a, 'recording', false)
  await expect(typing).toBeHidden({ timeout: 15_000 })
  await input.fill('пишу молча')
  await b.waitForTimeout(5000)
  await expect(typing).toBeHidden()
  await input.fill('')
  await mic.hover()
  await a.mouse.down()
  await b.waitForTimeout(4000)
  await expect(recording).toBeHidden()
  await a.mouse.up()

  // «В сети»: делятся оба — Боб видит Алису в сети.
  await setPrivacy(a, 'online', true)
  await setPrivacy(b, 'online', true)
  await expect(presence).toHaveText('в сети', { timeout: 60_000 })

  // Алиса скрыла статус — у Боба «был(а) в сети …». Synapse отпускает «в сети»
  // не по запросу, а когда истечёт синк, начатый с ним: около минуты.
  await setPrivacy(a, 'online', false)
  await expect(presence).toHaveText(/был\(а\) в сети/, { timeout: 120_000 })

  // Боб скрыл свой — чужие статусы ему не видны.
  await setPrivacy(b, 'online', false)
  await expect(presence).toHaveCount(0)

  await a.context().close()
  await b.context().close()
})
