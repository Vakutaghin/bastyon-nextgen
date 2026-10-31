// Число непрочитанных на значке: куда уходит на каждой платформе и что спрашиваем у Android.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: 'web',
  pluginAvailable: true,
  invoke: vi.fn(),
  set: vi.fn(),
  check: vi.fn(),
  request: vi.fn(),
}))

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      getPlatform: () => mocks.platform,
      isPluginAvailable: () => mocks.pluginAvailable,
    },
  }
})
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/plugins/app-badge', () => ({
  AppBadge: { set: mocks.set, checkPermissions: mocks.check, requestPermissions: mocks.request },
}))

import { appBadgeTarget, ensureAppBadgePermission, showAppBadge } from './app-badge'

const texts = {
  tooltip: 'Bastyon NextGen — 3 непрочитанных сообщения',
  title: 'Bastyon NextGen',
  text: '3 непрочитанных сообщения',
  channel: 'Непрочитанные сообщения',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.platform = 'web'
  mocks.pluginAvailable = true
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('showAppBadge', () => {
  it('компьютер — команда Tauri с подсказкой трея', async () => {
    vi.stubEnv('VITE_TAURI', 'true')
    expect(appBadgeTarget()).toBe('tauri')
    await showAppBadge(3.7, texts)
    expect(mocks.invoke).toHaveBeenCalledWith('app_badge_set', { count: 3, tooltip: texts.tooltip })
  })

  it('Android — плагин с текстами уведомления; без плагина — ничего', async () => {
    mocks.platform = 'android'
    await showAppBadge(3, texts)
    expect(mocks.set).toHaveBeenCalledWith({
      count: 3,
      title: 'Bastyon NextGen',
      text: '3 непрочитанных сообщения',
      channel: 'Непрочитанные сообщения',
    })
    mocks.pluginAvailable = false
    expect(appBadgeTarget()).toBe('none')
  })

  it('PWA — Badging API, 0 снимает число; iOS и браузер без API — ничего', async () => {
    const setAppBadge = vi.fn()
    const clearAppBadge = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, setAppBadge, clearAppBadge })
    await showAppBadge(5, texts)
    await showAppBadge(-2, texts)
    expect(setAppBadge).toHaveBeenCalledWith(5)
    expect(clearAppBadge).toHaveBeenCalledTimes(1)

    mocks.platform = 'ios'
    expect(appBadgeTarget()).toBe('none')
  })

  it('ошибка системы не выходит наружу', async () => {
    vi.stubEnv('VITE_TAURI', 'true')
    mocks.invoke.mockRejectedValueOnce(new Error('no window'))
    await expect(showAppBadge(1, texts)).resolves.toBeUndefined()
  })
})

describe('ensureAppBadgePermission', () => {
  it('Android спрашивает один раз; после отказа и с разрешением — не спрашивает', async () => {
    mocks.platform = 'android'
    mocks.check.mockResolvedValue({ notifications: 'prompt' })
    await ensureAppBadgePermission()
    await ensureAppBadgePermission()
    expect(mocks.request).toHaveBeenCalledTimes(1)

    // Включил тумблер в настройках — спрашиваем снова, пока система не ответила окончательно.
    await ensureAppBadgePermission(true)
    expect(mocks.request).toHaveBeenCalledTimes(2)

    mocks.check.mockResolvedValue({ notifications: 'denied' })
    await ensureAppBadgePermission(true)
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })

  it('не Android — не спрашивает', async () => {
    await ensureAppBadgePermission(true)
    expect(mocks.check).not.toHaveBeenCalled()
  })
})
