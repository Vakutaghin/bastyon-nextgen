import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { newAccounts, openChatWith, send, signedIn, type Account } from './support/live-matrix'

/**
 * Первое сообщение новому собеседнику из окна чата (миничат) вживую, на своём
 * Synapse: комната создаётся этим сообщением, и синк может принести её посреди
 * создания — с именем и алиасом, но без приглашения собеседника. Тогда текст
 * уходил групповым протоколом с ключом для одного отправителя, и собеседник
 * видел «Не удалось расшифровать сообщение». Запуск — как matrix-receipts.live.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE })

const UNREADABLE = 'Не удалось расшифровать сообщение'

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

/** Первое сообщение комнаты у отправителя: групповое ли (`hash`) и сколько ключей группы. */
async function firstMessageProtocol(
  page: Page
): Promise<{ groupHash: boolean; groupKeys: number }> {
  return page.evaluate(async () => {
    const { matrixService } = await import('/src/b-components/messenger/services/matrix-service.ts')
    const room = matrixService.getRooms()[0] as {
      getLiveTimeline: () => {
        getEvents: () => { getType: () => string; getContent: () => { hash?: string } }[]
      }
    }
    const events = room.getLiveTimeline().getEvents()
    const first = events.find((e) => e.getType() === 'm.room.message')
    return {
      groupHash: !first || typeof first.getContent().hash === 'string',
      groupKeys: events.filter((e) => e.getType() === 'm.room.encryption').length,
    }
  })
}

async function sendFirst(a: Page, bob: Account, text: string): Promise<void> {
  await openChatWith(a, bob, true)
  // Окно чата, а не полноэкранный мессенджер.
  await expect(
    a.getByRole('button', { name: /Потяните, чтобы изменить размер окна/ })
  ).toBeVisible()
  await send(a, text)
  await expect(a.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()).toHaveAttribute(
    'title',
    'Отправлено, ещё не прочитано',
    { timeout: 60_000 }
  )
  // Личный протокол, как у прежнего клиента: без `hash` и ключа группы.
  const protocol = await firstMessageProtocol(a)
  expect(protocol.groupHash).toBe(false)
  expect(protocol.groupKeys).toBe(0)
}

test('собеседник уже входил в чат — первое сообщение он читает', async ({ browser }) => {
  test.setTimeout(240_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data = profiles(alice!, bob!)
  const a = await signedIn(browser, alice!, data)
  const b = await signedIn(browser, bob!, data)

  await sendFirst(a, bob!, 'Привет, это первое')
  await openChatWith(b, alice!, false)
  await expect(b.getByText('Привет, это первое')).toBeVisible({ timeout: 90_000 })
  await expect(b.getByText(UNREADABLE)).toHaveCount(0)

  // И ответ доходит обратно.
  await send(b, 'Ответ')
  await expect(a.getByText('Ответ')).toBeVisible({ timeout: 60_000 })
})

test('собеседник ещё ни разу не входил в чат — первое сообщение ждёт его и читается', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const [alice, bob] = await newAccounts(browser, 2)
  const data = profiles(alice!, bob!)
  const a = await signedIn(browser, alice!, data)

  // У Боба ещё нет пользователя на сервере чатов: приглашение сервер принимает.
  await sendFirst(a, bob!, 'Привет до твоего первого входа')

  const b = await signedIn(browser, bob!, data)
  await openChatWith(b, alice!, false)
  await expect(b.getByText('Привет до твоего первого входа')).toBeVisible({ timeout: 90_000 })
  await expect(b.getByText(UNREADABLE)).toHaveCount(0)
})
