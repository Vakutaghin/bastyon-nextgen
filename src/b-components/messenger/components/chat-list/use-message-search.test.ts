// Сообщения в поиске над списком чатов: все чаты, от новых к старым; ленты в
// памяти — сразу, ленты комнат и копия на устройстве — по мере чтения;
// без повторов; «Показать ещё»; закрыли поиск — чтение прекращается.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Dialog, Message } from '../../types'

// Передышка между чатами — через MessageChannel, фальшивые таймеры её не ждут.
vi.mock('@/helpers/common/yield-to-main', () => ({ yieldToMain: () => Promise.resolve() }))

import { MESSAGE_PAGE, MESSAGE_SEARCH_DEBOUNCE_MS, useMessageSearch } from './use-message-search'

const msg = (chatId: string, id: string, text: string, timestamp: number): Message => ({
  id,
  chatId,
  senderId: '@a',
  text,
  timestamp,
  read: true,
  status: 'sent',
})

const dialog = (id: string, last?: Message): Dialog =>
  ({ id, partner: { id: '@a', name: id }, unreadCount: 0, lastMessage: last }) as Dialog

function setup(opts: {
  chats: Dialog[]
  loaded?: Record<string, Message[]>
  recent?: Record<string, Message[]>
  archived?: Record<string, Message[]>
}) {
  const query = ref('')
  const open = ref(true)
  const recent = vi.fn(async (id: string) => opts.recent?.[id] ?? [])
  const archived = vi.fn(async (id: string) => opts.archived?.[id] ?? [])
  const scope = effectScope()
  const api = scope.run(() =>
    useMessageSearch({
      query,
      open: () => open.value,
      chats: () => opts.chats,
      loaded: (id) => opts.loaded?.[id],
      recent,
      archived,
    })
  )!
  return { ...api, query, open, recent, archived, scope }
}

async function type(s: { query: { value: string } }, text: string): Promise<void> {
  s.query.value = text
  await vi.advanceTimersByTimeAsync(MESSAGE_SEARCH_DEBOUNCE_MS)
  await vi.runAllTimersAsync()
  await nextTick()
}

const ids = (hits: { message: Message }[]) => hits.map((h) => h.message.id)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useMessageSearch', () => {
  it('во всех чатах, от новых к старым: лента в памяти, лента комнаты, копия, последнее в списке', async () => {
    const s = setup({
      chats: [dialog('!a', msg('!a', '$a-last', 'отпуск в мае', 50)), dialog('!b')],
      loaded: { '!a': [msg('!a', '$a1', 'Планы на отпуск', 40), msg('!a', '$a2', 'пока', 41)] },
      recent: { '!b': [msg('!b', '$b1', 'отпускные пришли', 45)] },
      archived: { '!b': [msg('!b', '$b0', 'старый отпуск', 1)] },
    })
    await type(s, 'отпу')
    expect(ids(s.hits.value)).toEqual(['$a-last', '$b1', '$a1', '$b0'])
    expect(s.hits.value[1]!.chatId).toBe('!b')
    expect(s.reading.value).toBe(false)
  })

  it('одно и то же сообщение из разных мест — один раз', async () => {
    const same = msg('!a', '$1', 'отпуск', 10)
    const s = setup({
      chats: [dialog('!a', same)],
      loaded: { '!a': [same] },
      recent: { '!a': [{ ...same }] },
      archived: { '!a': [{ ...same }] },
    })
    await type(s, 'отпуск')
    expect(ids(s.hits.value)).toEqual(['$1'])
  })

  it('без слов не читает ничего; ленты комнат и копию — один раз за поиск', async () => {
    const s = setup({ chats: [dialog('!a'), dialog('!b')] })
    await type(s, ' ?! ')
    expect(s.recent).not.toHaveBeenCalled()
    await type(s, 'отпуск')
    await type(s, 'отпуск море')
    expect(s.recent).toHaveBeenCalledTimes(2)
    expect(s.archived).toHaveBeenCalledTimes(2)
  })

  it('пока читается — «читаю», найденное в памяти уже видно', async () => {
    let release: (list: Message[]) => void = () => {}
    const s = setup({
      chats: [dialog('!a')],
      loaded: { '!a': [msg('!a', '$1', 'отпуск', 10)] },
    })
    s.archived.mockImplementationOnce(() => new Promise((r) => (release = r)))
    s.query.value = 'отпуск'
    await vi.advanceTimersByTimeAsync(MESSAGE_SEARCH_DEBOUNCE_MS)
    await nextTick()
    expect(s.reading.value).toBe(true)
    expect(ids(s.hits.value)).toEqual(['$1'])
    release([msg('!a', '$0', 'отпуск давно', 1)])
    await vi.runAllTimersAsync()
    expect(s.reading.value).toBe(false)
    expect(ids(s.hits.value)).toEqual(['$1', '$0'])
  })

  it(`показано ${MESSAGE_PAGE}, «Показать ещё» — следующие; новый запрос — снова ${MESSAGE_PAGE}`, async () => {
    const many = Array.from({ length: 45 }, (_, i) => msg('!a', `$${i}`, `отпуск ${i}`, i))
    const s = setup({ chats: [dialog('!a')], loaded: { '!a': many } })
    await type(s, 'отпуск')
    expect(s.shown.value).toHaveLength(MESSAGE_PAGE)
    expect(s.hasMore.value).toBe(true)
    s.more()
    s.more()
    expect(s.shown.value).toHaveLength(45)
    expect(s.hasMore.value).toBe(false)
    await type(s, 'отпуск 1')
    expect(s.shown.value.length).toBeLessThanOrEqual(MESSAGE_PAGE)
  })

  it('закрыли поиск — чтение прекращается, найденного нет', async () => {
    let release: (list: Message[]) => void = () => {}
    const s = setup({ chats: [dialog('!a'), dialog('!b')] })
    s.recent.mockImplementationOnce(() => new Promise((r) => (release = r)))
    s.query.value = 'отпуск'
    await vi.advanceTimersByTimeAsync(MESSAGE_SEARCH_DEBOUNCE_MS)
    await nextTick()
    s.open.value = false
    await nextTick()
    release([msg('!a', '$1', 'отпуск', 1)])
    await vi.runAllTimersAsync()
    expect(s.recent).toHaveBeenCalledTimes(1)
    expect(s.hits.value).toEqual([])
    expect(s.reading.value).toBe(false)
  })

  it('стёрли запрос — найденное пропадает сразу, без паузы', async () => {
    const s = setup({ chats: [dialog('!a')], loaded: { '!a': [msg('!a', '$1', 'отпуск', 1)] } })
    await type(s, 'отпуск')
    expect(s.hits.value).toHaveLength(1)
    s.query.value = ''
    await nextTick()
    expect(s.hits.value).toEqual([])
  })
})
