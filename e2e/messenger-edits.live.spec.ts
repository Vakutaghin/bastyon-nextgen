import { test, expect, type Page } from '@playwright/test'
import { type MockNodeData } from './support/mock-node'
import { matrixReady, newAccounts, openChatWith, send, signedIn } from './support/live-matrix'

/**
 * Правки сообщений вживую на своём Synapse: правка уходит так, как её шлёт
 * прежний клиент, — обычное зашифрованное сообщение со ссылкой `m.replace`, без
 * `m.new_content`. Запуск — как у matrix-receipts.live.spec.ts.
 */

const BASE = process.env.E2E_SYNAPSE_URL
test.skip(!BASE, 'нужен локальный Synapse, см. шапку matrix-receipts.live.spec.ts')
test.use({ baseURL: BASE })

type ChatStore = {
  messages: Record<string, { id: string; text: string }[]>
  sendTextContent: (
    chatId: string,
    text: string,
    extra?: Record<string, unknown>
  ) => Promise<{ event_id?: string }>
}

/** Исправить последнее своё сообщение открытого чата — в формате прежнего клиента. */
async function editLast(page: Page, text: string): Promise<void> {
  await page.evaluate(async (next) => {
    const app = (
      document.querySelector('#app') as unknown as {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
      }
    ).__vue_app__
    const pinia = app.config.globalProperties.$pinia._s
    const ui = pinia.get('messenger-ui') as { activeChatId: string }
    const chat = pinia.get('messenger-chat') as ChatStore
    const last = chat.messages[ui.activeChatId]!.filter((m) => m.id.startsWith('$')).at(-1)!
    await chat.sendTextContent(ui.activeChatId, next, {
      'm.relates_to': { rel_type: 'm.replace', event_id: last.id },
    })
  }, text)
}

const bubbles = (page: Page) =>
  page.locator('.message-text').filter({ hasText: /передадим|другое сообщение/ })

test('правки прежнего клиента — одно сообщение с последним текстом, а не пять', async ({
  browser,
}) => {
  test.setTimeout(300_000)
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
  await Promise.all([matrixReady(a), matrixReady(b)])

  await openChatWith(a, bob!, true)
  await send(a, 'передадим тек кто займётся')
  await expect(a.getByTitle(/^(Прочитано|Отправлено, ещё не прочитано)$/).last()).toBeVisible({
    timeout: 60_000,
  })
  await openChatWith(b, alice!, false, { invited: true })
  await expect(b.getByText('передадим тек кто займётся')).toBeVisible({ timeout: 90_000 })

  // Открытый чат: текст меняется на месте, у обоих.
  const versions = [
    'передадим тем кто займётся',
    'передадим тем кто займётся. Он работает',
    'передадим тем кто займётся. Он работает, давно проверено',
  ]
  for (const text of versions) {
    await editLast(a, text)
    for (const page of [a, b]) {
      await expect(bubbles(page)).toHaveText([text], { timeout: 30_000 })
      await expect(page.getByTestId('edited-mark')).toHaveCount(1)
    }
  }

  // Следующее сообщение и правка прежнего — порядок тот же.
  await send(a, 'другое сообщение')
  await expect(bubbles(b)).toHaveText([versions[2]!, 'другое сообщение'], { timeout: 30_000 })

  // Чат закрыт: правка не новое сообщение — ни строки, ни числа непрочитанных.
  await b.keyboard.press('Escape')
  const row = b.getByTestId('chat-row').filter({ hasText: 'alice_e2e' })
  await expect(row).toContainText('другое сообщение')
  await editLast(a, 'другое сообщение, исправленное')
  await expect(row).toContainText('другое сообщение, исправленное', { timeout: 30_000 })
  await expect(b.getByRole('button', { name: 'Сообщения', exact: true })).toHaveText('')

  // После перезапуска — то же: правку приложил сервер.
  await b.reload()
  await openChatWith(b, alice!, false)
  await expect(bubbles(b)).toHaveText([versions[2]!, 'другое сообщение, исправленное'], {
    timeout: 60_000,
  })
  await expect(b.getByTestId('edited-mark')).toHaveCount(2)
})
