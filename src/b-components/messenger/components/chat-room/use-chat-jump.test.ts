// Переходы по ленте: цитата — к исходному сообщению (догрузка, если его нет
// в ленте; возврат к ответу), календарь — к первому сообщению дня; к чему
// пришли — подсвечено; «Остановить» и смена чата прерывают догрузку.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, shallowRef } from 'vue'
import type { Message } from '../../types'
import { FLASH_MS, useChatJump } from './use-chat-jump'

const msg = (id: string, timestamp: number, over: Partial<Message> = {}): Message => ({
  id,
  chatId: '!r',
  senderId: '@a',
  text: id,
  timestamp,
  read: true,
  status: 'sent',
  ...over,
})

function setup(opts: { feed?: Message[]; older?: Message[]; time?: number | null } = {}) {
  const chatId = ref<string | null>('!r')
  const feed = shallowRef<Message[]>(opts.feed ?? [msg('$5', 50), msg('$6', 60)])
  const older = opts.older ?? []
  const revealed: string[] = []
  const reveal = vi.fn(async (id: string) => {
    revealed.push(id)
    return feed.value.some((m) => m.id === id)
  })
  // Догрузка: всё старшее разом.
  const load = vi.fn(async () => {
    feed.value = [...older, ...feed.value]
  })
  const loadDate = vi.fn(async () => {
    feed.value = [...older, ...feed.value]
  })
  const timeOf = vi.fn(async () => (opts.time === undefined ? 10 : opts.time))
  const missing = vi.fn()
  const scope = effectScope()
  const api = scope.run(() =>
    useChatJump({
      chatId: () => chatId.value,
      messages: () => feed.value,
      reveal,
      load,
      loadDate,
      timeOf,
      missing,
    })
  )!
  return { ...api, chatId, feed, reveal, revealed, load, loadDate, timeOf, missing, scope }
}

const reply = (to: string) => msg('$r', 70, { replyTo: { id: to } })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useChatJump: цитата ответа', () => {
  it('исходное в ленте — прокрутка к нему, подсветка на миг, возврат — к ответу', async () => {
    const s = setup()
    await s.toReply(reply('$5'))
    expect(s.revealed).toEqual(['$5'])
    expect(s.load).not.toHaveBeenCalled()
    expect(s.flashId.value).toBe('$5')
    expect(s.returnTo.value).toBe('$r')
    vi.advanceTimersByTime(FLASH_MS)
    expect(s.flashId.value).toBeNull()
    s.feed.value = [...s.feed.value, reply('$5')]
    await s.back()
    expect(s.revealed).toEqual(['$5', '$r'])
    expect(s.returnTo.value).toBeNull()
  })

  it('исходного нет в ленте — узнаём время, догружаем до него, пока идёт — «ищу»', async () => {
    let release: () => void = () => {}
    const s = setup({ older: [msg('$1', 10)] })
    s.timeOf.mockImplementationOnce(() => new Promise<number>((r) => (release = () => r(10))))
    const done = s.toReply(reply('$1'))
    expect(s.work.value).toEqual({ kind: 'reply' })
    release()
    await done
    expect(s.load).toHaveBeenCalledWith('!r', { id: '$1', timestamp: 10 }, expect.any(Function))
    expect(s.revealed).toEqual(['$1'])
    expect(s.work.value).toBeNull()
  })

  it('время не узнали — догружаем без него', async () => {
    const s = setup({ older: [msg('$1', 10)], time: null })
    await s.toReply(reply('$1'))
    expect(s.load).toHaveBeenCalledWith(
      '!r',
      { id: '$1', timestamp: undefined },
      expect.any(Function)
    )
  })

  it('не нашлось или удалено — так и говорим, лента на месте', async () => {
    const s = setup()
    await s.toReply(reply('$nowhere'))
    expect(s.missing).toHaveBeenCalledWith('gone')
    s.feed.value = [msg('$d', 1, { deleted: { by: '@a', at: 2 } }), ...s.feed.value]
    await s.toReply(reply('$d'))
    expect(s.missing).toHaveBeenLastCalledWith('deleted')
    expect(s.reveal).not.toHaveBeenCalled()
  })

  it('«Остановить» и смена чата прерывают догрузку', async () => {
    const s = setup({ older: [msg('$1', 10)] })
    s.load.mockImplementationOnce(async (...args: unknown[]) => {
      const stopped = args[2] as () => boolean
      s.stop()
      expect(stopped()).toBe(true)
    })
    await s.toReply(reply('$1'))
    expect(s.reveal).not.toHaveBeenCalled()
    expect(s.work.value).toBeNull()

    s.load.mockImplementationOnce(async () => {
      s.chatId.value = '!other'
    })
    await s.toReply(reply('$1'))
    expect(s.reveal).not.toHaveBeenCalled()
  })
})

describe('useChatJump: к дате', () => {
  it('день в ленте — к первому его сообщению, без догрузки', async () => {
    const s = setup({ feed: [msg('$1', 10), msg('$2', 20), msg('$3', 30)] })
    await s.toDate(15)
    expect(s.loadDate).not.toHaveBeenCalled()
    expect(s.revealed).toEqual(['$2'])
    expect(s.flashId.value).toBe('$2')
  })

  it('раньше ленты — догружаем до него; позже всех — к последнему', async () => {
    const s = setup({ older: [msg('$1', 10), msg('$2', 20)] })
    await s.toDate(15)
    expect(s.loadDate).toHaveBeenCalledWith('!r', 15, expect.any(Function))
    expect(s.revealed).toEqual(['$2'])
    await s.toDate(10_000)
    expect(s.revealed).toEqual(['$2', '$6'])
  })

  it('переписка начинается позже даты — к самому первому сообщению', async () => {
    const s = setup()
    await s.toDate(1)
    expect(s.revealed).toEqual(['$5'])
  })

  it('переход к дате забывает возврат к ответу', async () => {
    const s = setup()
    await s.toReply(reply('$5'))
    await s.toDate(55)
    expect(s.returnTo.value).toBeNull()
  })

  it('сброс при смене чата — ни подсветки, ни возврата', async () => {
    const s = setup()
    await s.toReply(reply('$5'))
    s.reset()
    expect(s.flashId.value).toBeNull()
    expect(s.returnTo.value).toBeNull()
  })
})
