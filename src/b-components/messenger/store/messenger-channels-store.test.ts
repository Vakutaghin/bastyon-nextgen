// Каналы в мессенджере: список помнится по аккаунту, уходит на сервер чатов
// (один на все устройства), сливается с копией другого устройства, а строки
// каналов показывают последний пост и число новых.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AdaptedPost } from '@/types/adapted-post'

const h = vi.hoisted(() => ({
  client: {} as object | null,
  accountData: undefined as unknown,
  setAccountData: vi.fn(async (_type: string, _content: unknown) => {}),
  pages: {} as Record<string, AdaptedPost[]>,
  fetchChannelPage: vi.fn(),
}))

vi.mock('../services/matrix-service', () => ({
  matrixService: {
    getClient: () => h.client,
    getAccountData: () => h.accountData,
    setAccountData: h.setAccountData,
  },
}))
vi.mock('../lib/channel-feed', () => ({ fetchChannelPage: h.fetchChannelPage }))
vi.mock('@/services/logger', () => ({
  logger: { scope: () => ({ warn: vi.fn(), debug: vi.fn() }) },
}))

import { CHANNELS_ACCOUNT_DATA } from '../lib/channels'
import { useMessengerChannelsStore } from './messenger-channels-store'

const ME = 'PMeMeMeMeMeMeMeMeMeMeMeMeMeMeMeMeMe'
const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const KEY = `BST_MSG_CHANNELS_${ME}`

function post(txid: string, ms: number, over: Partial<AdaptedPost> = {}): AdaptedPost {
  return {
    id: txid,
    txid,
    author: {
      name: 'alice',
      address: ALICE,
      avatar: 'https://img/a.png',
      reputation: 0,
      letter: 'a',
    },
    title: '',
    content: `пост ${txid}`,
    timestamp: new Date(ms).toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    tags: [],
    type: 'share',
    category: 'share',
    images: [],
    ratingStars: 0,
    scoreCnt: 0,
    ...over,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 12, 0))
  h.client = {}
  h.accountData = undefined
  h.setAccountData.mockClear()
  h.pages = {}
  h.fetchChannelPage.mockReset()
  h.fetchChannelPage.mockImplementation(async (address: string) => ({
    posts: h.pages[address] ?? [],
    hasMore: false,
  }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('каналы: включение и память', () => {
  it('«Читать в мессенджере» — канал в списке, на диске и на сервере одной записью', async () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    expect(channels.addresses).toEqual([ALICE])
    expect(channels.isOn(ALICE)).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY)!).doc.items[ALICE].on).toBe(true)

    // Несколько изменений подряд — одна запись на сервер.
    channels.setChannel(BOB, true)
    expect(h.setAccountData).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(h.setAccountData).toHaveBeenCalledTimes(1)
    const [type, content] = h.setAccountData.mock.calls[0]!
    expect(type).toBe(CHANNELS_ACCOUNT_DATA)
    expect(Object.keys((content as { items: object }).items).sort()).toEqual([ALICE, BOB].sort())
  })

  it('после перезапуска список того же аккаунта на месте, у другого аккаунта — свой', () => {
    const first = useMessengerChannelsStore()
    first.attach(ME)
    first.setChannel(ALICE, true)

    setActivePinia(createPinia())
    const again = useMessengerChannelsStore()
    again.attach(ME)
    expect(again.addresses).toEqual([ALICE])
    again.attach(BOB)
    expect(again.addresses).toEqual([])
  })

  it('нового после включения нет: новое — то, что автор опубликует дальше', async () => {
    h.pages[ALICE] = [post('old', Date.now() - 60_000)]
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    await vi.runAllTimersAsync()
    expect(channels.summaries[ALICE]?.last?.txid).toBe('old')
    expect(channels.newCount(ALICE)).toBe(0)

    vi.setSystemTime(Date.now() + 3 * 60_000)
    h.pages[ALICE] = [post('fresh', Date.now() - 1000), post('old', Date.now() - 4 * 60_000)]
    await channels.refresh()
    expect(channels.newCount(ALICE)).toBe(1)
    expect(channels.withNew).toBe(1)
    channels.markAllSeen(ALICE)
    expect(channels.newCount(ALICE)).toBe(0)
  })

  it('выключенный канал уходит из списка, а отметка прочитанного остаётся', () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    const seen = channels.seenOf(ALICE)
    channels.setChannel(ALICE, false)
    expect(channels.addresses).toEqual([])
    expect(channels.seenOf(ALICE)).toBe(seen)
  })
})

describe('каналы: сервер чатов', () => {
  it('первый синк: серверный список сливается с локальным и возвращается на сервер', async () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    h.accountData = { v: 1, items: { [BOB]: { on: true, t: 1, seen: 5 } } }
    channels.syncWithServer()
    expect(channels.addresses.sort()).toEqual([ALICE, BOB].sort())
    // Канал с другого устройства сразу подтягивает последние посты.
    expect(h.fetchChannelPage).toHaveBeenCalledWith(BOB, expect.any(Number))
    await vi.runAllTimersAsync()
    const pushed = h.setAccountData.mock.calls[h.setAccountData.mock.calls.length - 1]![1] as {
      items: Record<string, unknown>
    }
    expect(Object.keys(pushed.items).sort()).toEqual([ALICE, BOB].sort())
  })

  it('выключили на другом устройстве позже — здесь канал тоже уходит, и обратно не пишем', async () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    await vi.runAllTimersAsync()
    h.setAccountData.mockClear()
    const later = Date.now() + 1000
    // Та копия уже знает и отметку прочитанного — она пришла ей с сервера.
    const seen = channels.seenOf(ALICE)
    channels.applyRemote({ v: 1, items: { [ALICE]: { on: false, t: later, seen } } })
    expect(channels.addresses).toEqual([])
    await vi.runAllTimersAsync()
    expect(h.setAccountData).not.toHaveBeenCalled()
  })

  it('без сервера изменения ждут и уходят после синка', async () => {
    h.client = null
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    await vi.runAllTimersAsync()
    expect(h.setAccountData).not.toHaveBeenCalled()
    h.client = {}
    channels.syncWithServer()
    await vi.runAllTimersAsync()
    expect(h.setAccountData).toHaveBeenCalled()
  })

  it('прочитанное на телефоне — прочитано и здесь', async () => {
    h.pages[ALICE] = [post('p2', Date.now() + 2000), post('p1', Date.now() + 1000)]
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    await vi.runAllTimersAsync()
    expect(channels.newCount(ALICE)).toBe(2)
    const entry = channels.doc.items[ALICE]!
    channels.applyRemote({ v: 1, items: { [ALICE]: { ...entry, seen: Date.now() + 2000 } } })
    expect(channels.newCount(ALICE)).toBe(0)
  })
})

describe('каналы: строки списка', () => {
  it('обновляются не чаще раза в минуту и не все разом', async () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    for (const a of [ALICE, BOB]) channels.setChannel(a, true)
    await vi.runAllTimersAsync()
    h.fetchChannelPage.mockClear()
    await channels.refresh()
    expect(h.fetchChannelPage).not.toHaveBeenCalled()
    vi.setSystemTime(Date.now() + 61_000)
    await channels.refresh()
    expect(h.fetchChannelPage).toHaveBeenCalledTimes(2)
  })

  it('имя и аватар автора берутся из ленты, пока профиля нет', async () => {
    h.pages[ALICE] = [post('p1', Date.now())]
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    await vi.runAllTimersAsync()
    expect(channels.summaries[ALICE]).toMatchObject({ name: 'alice', avatar: 'https://img/a.png' })
  })

  it('выход из аккаунта — в памяти пусто, на диске для следующего входа остаётся', () => {
    const channels = useMessengerChannelsStore()
    channels.attach(ME)
    channels.setChannel(ALICE, true)
    channels.reset()
    expect(channels.addresses).toEqual([])
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })
})
