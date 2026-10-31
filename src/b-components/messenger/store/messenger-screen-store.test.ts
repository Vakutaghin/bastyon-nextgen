// Фильтр входящих: настройка своя у каждого аккаунта на устройстве, спрятанные
// чаты не входят в счётчик, новое в них — на кнопке «Скрытые», входящее от
// спрятанного не звенит — и от нового собеседника тоже, когда придёт профиль.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'

import { MESSENGER_SCREEN_PREFIX } from '@/blockchain/constants/storage'

const auth = vi.hoisted(() => ({
  state: null as null | { isUserAuthenticated: boolean; getUserAddress: string | null },
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => auth.state }))

vi.mock('../helpers', () => ({
  getAddressFromMatrixId: (id: string): string | null =>
    id.startsWith('@') ? `P${id.slice(1).split(':')[0]}` : null,
}))

const cache = vi.hoisted(() => ({
  state: null as null | {
    userProfiles: Record<string, { reputation?: number; badges?: string[]; name?: string }>
    fetchProfiles: (a: string[]) => Promise<void>
  },
  /** Что «ответит» нода на запрос профиля. */
  node: {} as Record<string, { reputation?: number; badges?: string[]; name?: string }>,
}))
vi.mock('./messenger-profile-cache', () => ({ useMessengerProfileCache: () => cache.state }))

import { useMessengerScreenStore } from './messenger-screen-store'
import { useMessengerUiStore } from './messenger-ui-store'
import type { Dialog } from '../types'

const ME = 'PMe'
const OTHER_ACCOUNT = 'PSecond'

const direct = (id: string, user: string, patch: Partial<Dialog> = {}): Dialog => ({
  id,
  partner: { id: `@${user}:server`, name: user },
  unreadCount: 0,
  ...patch,
})

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  auth.state = reactive({ isUserAuthenticated: true, getUserAddress: ME })
  cache.node = {}
  const state = reactive({
    userProfiles: {} as Record<string, { reputation?: number; badges?: string[]; name?: string }>,
    fetchProfiles: vi.fn(async (addresses: string[]) => {
      for (const a of addresses) if (cache.node[a]) state.userProfiles[a] = cache.node[a]
    }),
  })
  cache.state = state
})

describe('messenger-screen-store', () => {
  it('правила — свои у каждого аккаунта и переживают перезапуск', async () => {
    const screen = useMessengerScreenStore()
    screen.setReputation(true, 25)
    expect(JSON.parse(localStorage.getItem(`${MESSENGER_SCREEN_PREFIX}${ME}`)!).reputation).toEqual(
      { on: true, below: 25 }
    )

    auth.state!.getUserAddress = OTHER_ACCOUNT
    await nextTick()
    expect(screen.prefs.reputation.on).toBe(false)

    auth.state!.getUserAddress = ME
    await nextTick()
    expect(screen.prefs.reputation).toEqual({ on: true, below: 25 })
  })

  it('спрятанные не в счётчике, новое в них — отдельно; «Показать» сбрасывает смена аккаунта', async () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.state!.userProfiles = { Pspam: { reputation: 0 }, Panna: { reputation: 300 } }
    ui.setDialogs([
      direct('!spam', 'spam', { unreadCount: 4 }),
      direct('!anna', 'anna', { unreadCount: 1 }),
    ])
    screen.setReputation(true, 10)

    expect([...screen.hiddenIds]).toEqual(['!spam'])
    expect(screen.hiddenUnread).toBe(4)
    expect(screen.hiddenWithNew).toBe(1)

    screen.toggleShowHidden()
    expect(screen.showHidden).toBe(true)
    auth.state!.getUserAddress = OTHER_ACCOUNT
    await nextTick()
    expect(screen.showHidden).toBe(false)
  })

  it('профиль собеседника не загружен — грузит его сам, пока правила его ждут', async () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.node = { Pspam: { reputation: 0 } }
    screen.setReputation(true, 10)
    ui.setDialogs([direct('!spam', 'spam')])
    await nextTick()
    expect(cache.state!.fetchProfiles).toHaveBeenCalledWith(['Pspam'])
    expect(screen.hiddenIds.has('!spam')).toBe(true)
  })

  it('чат, начатый вами, правила не прячут', () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.state!.userProfiles = { Pnewbie: { reputation: 0 } }
    ui.setDialogs([direct('!mine', 'newbie', { startedByMe: true })])
    screen.setReputation(true, 10)
    expect(screen.hiddenIds.size).toBe(0)
  })

  it('из меню чата: убрать в скрытые и вернуть — и вернуть того, кого прячут правила', () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.state!.userProfiles = { Panna: { reputation: 300 }, Pspam: { reputation: 0 } }
    const anna = direct('!anna', 'anna')
    const spam = direct('!spam', 'spam')
    ui.setDialogs([anna, spam])

    screen.hideChat(anna)
    expect(screen.prefs.people.Panna).toEqual({ rule: 'hide', name: 'anna' })
    expect(screen.reasonFor(anna)).toBe('person')
    screen.unhideChat(anna)
    expect(screen.prefs.people.Panna).toBeUndefined()
    expect(screen.reasonFor(anna)).toBeNull()

    screen.setReputation(true, 10)
    expect(screen.reasonFor(spam)).toBe('reputation')
    screen.unhideChat(spam)
    expect(screen.prefs.people.Pspam?.rule).toBe('show')
    expect(screen.reasonFor(spam)).toBeNull()
  })

  it('входящее: от спрятанного — тихо; первое от нового — тихо, когда профиль показал низкую репутацию', async () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.state!.userProfiles = { Panna: { reputation: 300 } }
    cache.node = { Pnew: { reputation: 0 } }
    ui.setDialogs([direct('!anna', 'anna')])

    // Фильтр выключен — звенит всё.
    expect(await screen.silences('!new', '@new:server')).toBe(false)
    expect(cache.state!.fetchProfiles).not.toHaveBeenCalled()

    screen.setReputation(true, 10)
    expect(await screen.silences('!anna', '@anna:server')).toBe(false)
    expect(await screen.silences('!new', '@new:server')).toBe(true)
    expect(cache.state!.fetchProfiles).toHaveBeenCalledWith(['Pnew'])
  })

  it('в группе фильтр не молчит: там нет одного «кто пишет»', async () => {
    const ui = useMessengerUiStore()
    const screen = useMessengerScreenStore()
    cache.state!.userProfiles = { Pspam: { reputation: 0 } }
    ui.setDialogs([
      {
        id: '!club',
        partner: { id: '!club', name: 'Клуб' },
        unreadCount: 3,
        group: { memberCount: 9, previewIds: [] },
      },
    ])
    screen.setReputation(true, 10)
    expect(await screen.silences('!club', '@spam:server')).toBe(false)
    expect(screen.hiddenIds.size).toBe(0)
  })
})
