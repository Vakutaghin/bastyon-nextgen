// Счётчик вне окна: число мессенджера после затишья, тексты на языке приложения, выключатель, заголовок вкладки.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  ensure: vi.fn(),
  messenger: null as unknown as { totalUnreadCount: number },
  settings: null as unknown as { appBadge: boolean; getFilter: (key: string) => boolean },
}))

vi.mock('@/services/app-badge', () => ({
  showAppBadge: mocks.show,
  ensureAppBadgePermission: mocks.ensure,
}))
vi.mock('@/b-components/messenger/store/messenger-store', () => ({
  useMessengerStore: () => mocks.messenger,
}))
vi.mock('@/stores/notification-settings-store', () => ({
  useNotificationSettingsStore: () => mocks.settings,
}))

import { i18n } from '@/i18n'
import { setDocumentTitle } from './use-document-title'
import { useAppBadge } from './use-app-badge'

let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  i18n.global.locale.value = 'ru'
  mocks.messenger = reactive({ totalUnreadCount: 0 })
  mocks.settings = reactive({
    appBadge: true,
    getFilter(key: string) {
      return key === 'appBadge' ? this.appBadge : true
    },
  })
  setDocumentTitle('Лента')
  scope = effectScope()
  scope.run(() => useAppBadge())
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

const settle = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(300)
}

describe('useAppBadge', () => {
  it('число мессенджера — системе после затишья, одним вызовом, с текстами и в заголовке', async () => {
    await settle()
    expect(mocks.show).toHaveBeenLastCalledWith(0, expect.anything())

    mocks.messenger.totalUnreadCount = 1
    await nextTick()
    mocks.messenger.totalUnreadCount = 3
    await settle()

    expect(mocks.show).toHaveBeenCalledTimes(2)
    expect(mocks.show).toHaveBeenLastCalledWith(3, {
      tooltip: 'Bastyon NextGen — 3 непрочитанных сообщения',
      title: 'Bastyon NextGen',
      text: '3 непрочитанных сообщения',
      channel: 'Непрочитанные сообщения',
    })
    expect(mocks.ensure).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('(3) Лента — Bastyon NextGen')
  })

  it('тумблер выключен — 0 и заголовок без числа; язык сменился — тексты заново', async () => {
    mocks.messenger.totalUnreadCount = 21
    await settle()
    expect(mocks.show).toHaveBeenLastCalledWith(
      21,
      expect.objectContaining({ text: '21 непрочитанное сообщение' })
    )

    i18n.global.locale.value = 'en'
    await settle()
    expect(mocks.show).toHaveBeenLastCalledWith(
      21,
      expect.objectContaining({ text: '21 unread messages' })
    )

    mocks.settings.appBadge = false
    await settle()
    expect(mocks.show).toHaveBeenLastCalledWith(0, expect.anything())
    expect(document.title).toBe('Лента — Bastyon NextGen')
  })

  it('больше 99 — «99+» в заголовке', async () => {
    mocks.messenger.totalUnreadCount = 150
    await settle()
    expect(document.title).toBe('(99+) Лента — Bastyon NextGen')
  })
})
