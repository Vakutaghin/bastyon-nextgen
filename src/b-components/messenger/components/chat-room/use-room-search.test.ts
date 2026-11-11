// Поиск по переписке: найденное от новых к старым, первое — сразу, Enter —
// старше, Shift+Enter — новее; новый запрос — снова с самого свежего; нашлось
// ещё — стоим на том же; найденное глубже ленты — догрузка до него.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import type { Message } from '../../types'
import { SEARCH_DEBOUNCE_MS, useRoomSearch } from './use-room-search'

const msg = (id: string, text: string, timestamp: number): Message => ({
  id,
  chatId: '!r',
  senderId: '@a',
  text,
  timestamp,
  read: true,
  status: 'sent',
})

const FEED = [
  msg('$1', 'Привет, как дела?', 1),
  msg('$2', 'Пока ничего', 2),
  msg('$3', 'привет ещё раз', 3),
  msg('$4', 'Приветствую всех', 4),
]

function setup(opts: { extra?: Message[]; loadable?: boolean } = {}) {
  const feed = shallowRef<Message[]>([...FEED])
  const extra = shallowRef<Message[]>(opts.extra ?? [])
  const revealed: string[] = []
  const reveal = vi.fn(async (id: string) => {
    revealed.push(id)
    return feed.value.some((m) => m.id === id)
  })
  const load = vi.fn(async (m: Message) => {
    feed.value = [m, ...feed.value]
    return true
  })
  const scope = effectScope()
  const api = scope.run(() =>
    useRoomSearch({
      messages: () => feed.value,
      extra: () => extra.value,
      reveal,
      load: opts.loadable === false ? undefined : load,
    })
  )!
  return { ...api, feed, extra, reveal, revealed, load, scope }
}

async function type(api: ReturnType<typeof setup>, text: string): Promise<void> {
  api.query.value = text
  await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
  await nextTick()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useRoomSearch', () => {
  it('найденное — от новых к старым, и сразу к самому свежему', async () => {
    const s = setup()
    await type(s, 'прив')
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$3', '$1'])
    expect(s.currentId.value).toBe('$4')
    expect(s.revealed).toEqual(['$4'])
  })

  it('старше — вверх по найденному, новее — обратно; у краёв стоим', async () => {
    const s = setup()
    await type(s, 'прив')
    s.older()
    await nextTick()
    expect(s.currentId.value).toBe('$3')
    s.older()
    s.older()
    await nextTick()
    expect(s.currentId.value).toBe('$1')
    s.newer()
    await nextTick()
    expect(s.currentId.value).toBe('$3')
    expect(s.revealed).toEqual(['$4', '$3', '$1', '$3'])
  })

  it('Enter до конца паузы ищет сразу, не дожидаясь её', async () => {
    const s = setup()
    s.query.value = 'пока'
    s.older()
    await nextTick()
    expect(s.hits.value.map((m) => m.id)).toEqual(['$2'])
  })

  it('новый запрос — снова с самого свежего найденного', async () => {
    const s = setup()
    await type(s, 'прив')
    s.older()
    await nextTick()
    expect(s.currentId.value).toBe('$3')
    // «Приветствую» тоже начинается с «привет»: самое свежее — снова $4.
    await type(s, 'привет')
    expect(s.currentId.value).toBe('$4')
    expect(s.index.value).toBe(0)
  })

  it('нашлось ещё (подгрузили историю) — стоим на том же сообщении', async () => {
    const s = setup()
    await type(s, 'прив')
    s.older()
    await nextTick()
    s.feed.value = [msg('$0', 'Привет из прошлого', 0), ...s.feed.value]
    await nextTick()
    expect(s.currentId.value).toBe('$3')
    expect(s.hits.value).toHaveLength(4)
  })

  it('найденное глубже ленты — вместе с лентой, без повторов', async () => {
    const s = setup({ extra: [msg('$-1', 'привет, давно', -1), FEED[0]!] })
    await type(s, 'привет')
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$3', '$1', '$-1'])
  })

  it('его ещё нет в ленте — догрузить до него и прокрутить', async () => {
    const deep = msg('$-1', 'привет, давно', -1)
    const s = setup({ extra: [deep] })
    await type(s, 'давно')
    await vi.runAllTimersAsync()
    expect(s.load).toHaveBeenCalledWith(deep)
    expect(s.revealed).toEqual(['$-1', '$-1'])
    expect(s.opening.value).toBe(false)
  })

  it('ничего не нашлось — нечего открывать', async () => {
    const s = setup()
    await type(s, 'самокат')
    expect(s.hits.value).toEqual([])
    expect(s.currentId.value).toBeNull()
    expect(s.reveal).not.toHaveBeenCalled()
  })

  it('сброс — поиск выключен, найденного нет', async () => {
    const s = setup()
    await type(s, 'прив')
    s.clear()
    await nextTick()
    expect(s.active.value).toBe(false)
    expect(s.hits.value).toEqual([])
  })

  it('открыли из поиска по всем чатам — стоит на выбранном, стрелки — по найденному в чате', async () => {
    const s = setup()
    s.openAt('прив', FEED[2]!)
    await nextTick()
    expect(s.query.value).toBe('прив')
    expect(s.currentId.value).toBe('$3')
    expect(s.revealed).toEqual(['$3'])
    s.older()
    await nextTick()
    expect(s.currentId.value).toBe('$1')
  })

  it('выбранного ещё нет в ленте — оно в найденном сразу, лента догружается до него', async () => {
    const s = setup()
    const deep = msg('$-5', 'привет из архива', -5)
    s.openAt('привет', deep)
    await vi.runAllTimersAsync()
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$3', '$1', '$-5'])
    expect(s.currentId.value).toBe('$-5')
    expect(s.load).toHaveBeenCalledWith(deep)
  })

  it('тот же запрос уже набран — всё равно встаёт на выбранное', async () => {
    const s = setup()
    await type(s, 'прив')
    expect(s.currentId.value).toBe('$4')
    s.openAt('прив', FEED[0]!)
    await nextTick()
    expect(s.currentId.value).toBe('$1')
    // Пауза в наборе после этого ничего не сбивает.
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    await nextTick()
    expect(s.currentId.value).toBe('$1')
  })

  it('из одних знаков — не поиск', async () => {
    const s = setup()
    await type(s, ' ?! ')
    expect(s.active.value).toBe(false)
  })
})

describe('useRoomSearch: сообщения участника', () => {
  const GROUP = [
    { ...msg('$1', 'Привет всем', 1), senderId: '@bob' },
    { ...msg('$2', 'Привет, Боб', 2), senderId: '@eve' },
    { ...msg('$3', '', 3), senderId: '@bob', type: 'image' as const },
    { ...msg('$4', 'привет снова', 4), senderId: '@bob' },
    { ...msg('$5', 'удалено', 5), senderId: '@bob', deleted: { by: '@bob', at: 6 } },
  ]

  function group() {
    const s = setup()
    s.feed.value = [...GROUP]
    return s
  }

  it('без слов — все его сообщения, от новых к старым, и сразу к самому свежему', async () => {
    const s = group()
    s.setSender('@bob')
    await nextTick()
    expect(s.active.value).toBe(true)
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$3', '$1'])
    expect(s.revealed).toEqual(['$4'])
  })

  it('со словами — только его сообщения с ними; сменили участника — снова с самого свежего', async () => {
    const s = group()
    await type(s, 'привет')
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$2', '$1'])
    s.older()
    await nextTick()
    s.setSender('@bob')
    await nextTick()
    expect(s.hits.value.map((m) => m.id)).toEqual(['$4', '$1'])
    expect(s.index.value).toBe(0)
    s.setSender(null)
    await nextTick()
    expect(s.hits.value).toHaveLength(3)
  })

  it('сброс убирает и участника', async () => {
    const s = group()
    s.setSender('@bob')
    s.clear()
    await nextTick()
    expect(s.sender.value).toBeNull()
    expect(s.active.value).toBe(false)
  })

  it('свои сообщения с id «me» — тоже свои', async () => {
    const feed = shallowRef<Message[]>([
      { ...msg('$1', 'одно', 1), senderId: 'me' },
      { ...msg('$2', 'другое', 2), senderId: '@me' },
    ])
    const scope = effectScope()
    const s = scope.run(() =>
      useRoomSearch({
        messages: () => feed.value,
        reveal: async () => true,
        fromSender: (m, who) => m.senderId === who || (who === '@me' && m.senderId === 'me'),
      })
    )!
    s.setSender('@me')
    await nextTick()
    expect(s.hits.value.map((m) => m.id)).toEqual(['$2', '$1'])
    scope.stop()
  })
})
