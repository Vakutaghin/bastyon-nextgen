import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { newAccounts, openChatWith, send, signedIn } from './support/live-matrix'

/**
 * Переписка на устройстве вживую, на своём Synapse: копия пишется у обоих;
 * Боб удаляет сообщение Алисы — оно пропадает у неё и из её копии; сервер
 * стирает старую переписку (admin purge_history, как по сроку хранения) —
 * Алиса после перезапуска видит стёртое из копии со значком; её удаление
 * такого сообщения доходит до копии Боба (redaction стёртого Synapse не
 * отдаёт — идёт событие lib/archive-redact). Без E2E_SYNAPSE_URL пропускается.
 * Запуск — как matrix-receipts.live.spec.ts, плюс админ Synapse:
 *
 *   docker exec <synapse> register_new_matrix_user -u admin -p <пароль> -a \
 *     -c /data/homeserver.yaml http://localhost:8008
 *   E2E_SYNAPSE_URL=http://127.0.0.1:1981 E2E_SYNAPSE_DIRECT=http://127.0.0.1:8008 \
 *   E2E_SYNAPSE_ADMIN=admin:<пароль> playwright test messenger-archive.live
 */

const BASE = process.env.E2E_SYNAPSE_URL
const DIRECT = process.env.E2E_SYNAPSE_DIRECT
const ADMIN = process.env.E2E_SYNAPSE_ADMIN
test.skip(!BASE || !DIRECT || !ADMIN, 'нужен локальный Synapse с админом, см. шапку файла')
test.use({ baseURL: BASE })

type Stores = Map<string, Record<string, unknown>>

/** Вызов стора страницы; результат — простым JSON. */
async function store(page: Page, id: string, method: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(
    async ({ id, method, args }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const s = stores.get(id) as Record<string, unknown>
      const value =
        typeof s[method] === 'function'
          ? await (s[method] as (...a: unknown[]) => unknown)(...args)
          : s[method]
      return JSON.parse(JSON.stringify(value ?? null))
    },
    { id, method, args }
  )
}

async function enableArchive(page: Page): Promise<void> {
  await expect.poll(() => store(page, 'messenger-archive', 'ready'), { timeout: 60_000 }).toBe(true)
  await store(page, 'messenger-archive', 'setEnabled', true)
}

/** Id сообщения в ленте открытого чата по тексту. */
async function idOf(page: Page, roomId: string, text: string): Promise<string> {
  const messages = (await store(page, 'messenger-chat', 'messages')) as Record<
    string,
    { id: string; text: string }[]
  >
  const id = messages[roomId]?.find((m) => m.text === text)?.id
  if (!id) throw new Error(`нет сообщения «${text}»`)
  return id
}

/** Сохранено ли сообщение в копии страницы. */
async function isSaved(page: Page, roomId: string, id: string): Promise<boolean> {
  return page.evaluate(
    async ({ roomId, id }) => {
      const stores = (
        document.querySelector('#app') as unknown as {
          __vue_app__: { config: { globalProperties: { $pinia: { _s: Stores } } } }
        }
      ).__vue_app__.config.globalProperties.$pinia._s
      const archive = stores.get('messenger-archive') as {
        savedAmong: (c: string, ids: string[]) => Promise<Set<string>>
      }
      return (await archive.savedAmong(roomId, [id])).has(id)
    },
    { roomId, id }
  )
}

async function adminToken(): Promise<string> {
  const [user, password] = ADMIN!.split(':')
  const res = await fetch(`${DIRECT}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user },
      password,
    }),
  })
  const body = (await res.json()) as { access_token?: string }
  if (!body.access_token) throw new Error(`admin login: ${JSON.stringify(body)}`)
  return body.access_token
}

/** Сервер стирает переписку комнаты раньше `ts` — как по сроку хранения. */
async function purgeBefore(roomId: string, ts: number): Promise<void> {
  const token = await adminToken()
  const res = await fetch(
    `${DIRECT}/_synapse/admin/v1/purge_history/${encodeURIComponent(roomId)}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ delete_local_events: true, purge_up_to_ts: ts }),
    }
  )
  const { purge_id: purgeId } = (await res.json()) as { purge_id?: string }
  if (!purgeId) throw new Error('purge не начался')
  await expect
    .poll(
      async () => {
        const status = await fetch(`${DIRECT}/_synapse/admin/v1/purge_history_status/${purgeId}`, {
          headers: { authorization: `Bearer ${token}` },
        })
        return ((await status.json()) as { status?: string }).status
      },
      { timeout: 60_000 }
    )
    .toBe('complete')
}

async function deleteMessage(page: Page, text: string, confirmText: RegExp): Promise<void> {
  const row = page.locator('[class*="others"], [class*="mine"]').filter({ hasText: text }).last()
  await row.hover()
  await row.getByTestId('message-actions').click()
  await page
    .locator('.message-actions-popover')
    .filter({ visible: true })
    .getByRole('button', { name: 'Удалить' })
    .click()
  const confirm = page.locator('.ant-modal-confirm').filter({ hasText: 'Удалить сообщение?' })
  await expect(confirm).toContainText(confirmText)
  await confirm.locator('.ant-btn-dangerous').click()
}

test('копия у обоих, удаление чужого, стёртое сервером — из копии, удаление доходит до копии собеседника', async ({
  browser,
}) => {
  test.setTimeout(420_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data: MockNodeData = {
    profiles: [
      { address: alice!.address, name: 'alice_e2e', k: alice!.keys },
      { address: bob!.address, name: 'bob_e2e', k: bob!.keys },
    ],
    posts: [],
    comments: [],
  }
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)
  await enableArchive(a)
  await enableArchive(b)

  // Первое сообщение нового чата у получателя сейчас не расшифровывается (ошибка
  // не про копию, есть и в matrix-receipts.live) — проверяем на следующих.
  await openChatWith(a, bob!, true)
  await send(a, 'Начало')
  await expect(a.getByText('Начало')).toBeVisible({ timeout: 60_000 })
  await send(a, 'Раз')
  await expect(a.getByText('Раз')).toBeVisible({ timeout: 60_000 })
  await send(a, 'Два')
  await openChatWith(b, alice!, false)
  await expect(b.getByText('Два')).toBeVisible({ timeout: 90_000 })
  await expect(b.getByText('Раз')).toBeVisible({ timeout: 60_000 })
  await send(b, 'Три')
  await expect(a.getByText('Три')).toBeVisible({ timeout: 60_000 })

  const roomId = (await store(a, 'messenger-ui', 'activeChatId')) as string
  const [one, two, three] = [
    await idOf(a, roomId, 'Раз'),
    await idOf(a, roomId, 'Два'),
    await idOf(a, roomId, 'Три'),
  ]
  for (const page of [a, b]) {
    for (const id of [one, two, three]) {
      await expect.poll(() => isSaved(page, roomId, id), { timeout: 30_000 }).toBe(true)
    }
  }

  // Боб удаляет сообщение Алисы: в личном чате у обоих есть права.
  await deleteMessage(b, 'Раз', /Сообщение от alice_e2e будет удалено у всех/)
  await expect(a.getByTestId('deleted-mark')).toContainText('bob_e2e удалил(а) сообщение', {
    timeout: 60_000,
  })
  await expect.poll(() => isSaved(a, roomId, one), { timeout: 30_000 }).toBe(false)

  // Сервер стирает всё до «Четыре» — как через три месяца.
  await send(a, 'Четыре')
  await expect(b.getByText('Четыре')).toBeVisible({ timeout: 60_000 })
  const fourTs = Date.now()
  await send(b, 'Пять')
  await expect(a.getByText('Пять')).toBeVisible({ timeout: 60_000 })
  await purgeBefore(roomId, fourTs)

  // Алиса запускается заново без кэша синка: с сервера приходит только оставшееся.
  await a.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? []
    await Promise.all(
      dbs
        .map((d) => d.name ?? '')
        .filter((name) => name.startsWith('matrix-js-sdk'))
        .map(
          (name) =>
            new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(name)
              req.onsuccess = req.onerror = req.onblocked = () => resolve(null)
            })
        )
    )
  })
  await a.reload()
  await a.waitForSelector('#app > *', { timeout: 30_000 })
  await expect
    .poll(() => store(a, 'messenger-ui', 'syncState'), { timeout: 120_000 })
    .toBe('SYNCING')
  await openChatWith(a, bob!, false)
  await expect(a.getByText('Пять')).toBeVisible({ timeout: 90_000 })
  const kept = a.locator('[class*="mine"]').filter({ hasText: 'Два' }).last()
  await expect(kept).toBeVisible({ timeout: 60_000 })
  await expect(kept.getByTestId('local-only-mark')).toBeVisible({ timeout: 60_000 })
  // «Начало», «Два», «Три»: «Раз» Боб удалил ещё до чистки.
  await expect(a.getByTestId('local-only-mark')).toHaveCount(3)
  await expect(a.getByText('Раз')).toHaveCount(0)
  await expect(a.getByTestId('archive-divider')).toBeVisible()

  // Удаление сохранённого: с устройства Алисы — и из копии Боба.
  await deleteMessage(a, 'Два', /Сообщения уже нет на сервере/)
  await expect.poll(() => isSaved(a, roomId, two), { timeout: 30_000 }).toBe(false)
  await expect.poll(() => isSaved(b, roomId, two), { timeout: 60_000 }).toBe(false)
  await expect(
    b.getByTestId('deleted-mark').filter({ hasText: 'alice_e2e удалил(а) сообщение' })
  ).toHaveCount(1)
  expect(await isSaved(b, roomId, three)).toBe(true)
})
