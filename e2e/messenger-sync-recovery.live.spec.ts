import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { matrixReady, newAccounts, signedIn } from './support/live-matrix'

/**
 * Сессию отозвали на сервере (выход «везде», чистка устройств): синк получает
 * M_UNKNOWN_TOKEN, и SDK останавливается насовсем. Мессенджер должен войти
 * заново сам. Запуск — как у matrix-receipts.live.spec.ts.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE })

/** Токен страницы и id её устройства. */
function session(page: Page) {
  return page.evaluate(async () => {
    const { matrixService } = await import('/src/b-components/messenger/services/matrix-service.ts')
    const client = matrixService.getClient()
    return {
      token: client?.getAccessToken?.() as string | undefined,
      device: client?.getDeviceId?.() as string | undefined,
      running: !!client?.clientRunning,
    }
  })
}

test('сессию отозвали на сервере — мессенджер входит заново, синк идёт', async ({ browser }) => {
  test.setTimeout(240_000)
  const [me] = await newAccounts(browser, 1)
  const data: MockNodeData = {
    profiles: [{ address: me!.address, name: 'me_e2e', k: me!.keys }],
    posts: [],
    comments: [],
  }
  const page = await signedIn(browser, me!, data)
  await matrixReady(page)
  const before = await session(page)
  expect(before.token).toBeTruthy()

  // Выход со всех устройств — с этого же токена, как сделало бы другое устройство.
  const res = await page.request.post(`${BASE}/_matrix/client/v3/logout/all`, {
    headers: { Authorization: `Bearer ${before.token}` },
    data: {},
  })
  expect(res.ok()).toBe(true)

  // Синк получает M_UNKNOWN_TOKEN — мессенджер входит заново: новое устройство, синк идёт.
  await expect
    .poll(
      async () => {
        const now = await session(page)
        return !!now.device && now.device !== before.device && now.running
      },
      { timeout: 120_000 }
    )
    .toBe(true)
  await matrixReady(page)
  const ui = await page.evaluate(() => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: {
          config: { globalProperties: { $pinia: { _s: Map<string, Record<string, unknown>> } } }
        }
      }
    ).__vue_app__
    const s = app.config.globalProperties.$pinia._s.get('messenger-ui')!
    return { state: s.syncState, error: s.syncError }
  })
  expect(ui.error).toBeNull()
})
