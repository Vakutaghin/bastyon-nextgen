// Всплывающие уведомления: «от кого» — ник или начало адреса, а не адрес
// целиком; нажатие закрывает тост и ведёт туда же, куда уведомление в списке.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  close: vi.fn(),
  names: {} as Record<string, string>,
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
  })

  it('от кого — ник, а пока его нет — начало адреса', () => {
    mocks.names.PBobKnown1111 = 'bob_ng'
    showToastsForNewNotifications(pinia, [answer('PBobKnown1111'), answer('PNoName2222222')])
    const descriptions = mocks.info.mock.calls.map(([o]) => o.description)
    expect(descriptions).toEqual([
      'notif.from:{"name":"bob_ng"}',
      'notif.from:{"name":"PNoName2…"}',
    ])
  })

  it('нажатие закрывает тост и открывает уведомление', () => {
    const open = vi.fn()
    const item = answer('PBob')
    showToastsForNewNotifications(pinia, [item], open)
    mocks.info.mock.calls[0]![0].onClick()
    expect(mocks.close).toHaveBeenCalledWith(item.id)
    expect(open).toHaveBeenCalledWith(item)
  })
})
