// Всплывающие уведомления: «от кого» — ник или начало адреса, а не адрес
// целиком; незнакомый ник догружается до показа; нажатие закрывает тост и
// ведёт туда же, куда уведомление в списке.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  close: vi.fn(),
  names: {} as Record<string, string>,
  /** Общий кэш имён (services/user-names) и то, что догрузит его запрос. */
  shared: {} as Record<string, string>,
  loadable: {} as Record<string, string>,
  preload: vi.fn(),
}))
vi.mock('@/services/user-names', () => ({
  userName: (address: string, known?: { name?: string }) =>
    known?.name || mocks.shared[address] || `${address.slice(0, 8)}…`,
  preloadUserNames: mocks.preload,
}))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { info: mocks.info, close: mocks.close },
}))
vi.mock('@/services/app-sounds', () => ({ playSound: vi.fn() }))
vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))
vi.mock('@/stores', () => ({
  useNotificationSettingsStore: () => ({}),
  useNotificationsStore: () => ({
    getEnrichment: (item: { from?: string }) => ({
      from: item.from ? { address: item.from, name: mocks.names[item.from] } : undefined,
    }),
  }),
}))
vi.mock('@/stores/notification-filtering', () => ({ isNotificationAllowed: () => true }))

import { showToastsForNewNotifications } from './notification-toasts'
import type { NotificationItem } from '@/stores/notifications-store'

const pinia = {} as Pinia
const answer = (from: string): NotificationItem => ({
  id: `a-${from}`,
  type: 'comment',
  mesType: 'answer',
  title: 'notif.titleAnswer',
  time: 0,
  seen: false,
  from,
})

describe('showToastsForNewNotifications', () => {
  beforeEach(() => {
    mocks.info.mockReset()
    mocks.close.mockReset()
    mocks.names = {}
    mocks.shared = {}
    mocks.loadable = {}
    mocks.preload.mockReset().mockImplementation(async (addresses: string[]) => {
      for (const a of addresses) if (mocks.loadable[a]) mocks.shared[a] = mocks.loadable[a]
    })
  })

  it('от кого — ник; незнакомый догружается до показа', async () => {
    mocks.names.PBobKnown1111 = 'bob_ng'
    mocks.loadable.PAliceLoad111 = 'alice_ng'
    await showToastsForNewNotifications(pinia, [answer('PBobKnown1111'), answer('PAliceLoad111')])
    expect(mocks.preload).toHaveBeenCalledWith(['PAliceLoad111'], 2500)
    const descriptions = mocks.info.mock.calls.map(([o]) => o.description)
    expect(descriptions).toEqual(['notif.from:{"name":"bob_ng"}', 'notif.from:{"name":"alice_ng"}'])
  })

  it('ник не пришёл — начало адреса, а не адрес целиком', async () => {
    await showToastsForNewNotifications(pinia, [answer('PNoName2222222')])
    expect(mocks.info.mock.calls[0]![0].description).toBe('notif.from:{"name":"PNoName2…"}')
  })

  it('ники известны — тост без ожидания', async () => {
    mocks.names.PBobKnown1111 = 'bob_ng'
    await showToastsForNewNotifications(pinia, [answer('PBobKnown1111')])
    expect(mocks.preload).not.toHaveBeenCalled()
  })

  it('нажатие закрывает тост и открывает уведомление', async () => {
    const open = vi.fn()
    const item = answer('PBob')
    await showToastsForNewNotifications(pinia, [item], open)
    mocks.info.mock.calls[0]![0].onClick()
    expect(mocks.close).toHaveBeenCalledWith(item.id)
    expect(open).toHaveBeenCalledWith(item)
  })
})
