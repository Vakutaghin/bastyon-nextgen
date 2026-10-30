import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const listeners: Array<(ev: { received: number; total: number }) => void> = []
  const remove = vi.fn(async () => {})
  return {
    listeners,
    remove,
    platform: 'android',
    plugin: {
      download: vi.fn(),
      install: vi.fn(),
      addListener: vi.fn(
        async (_event: string, cb: (ev: { received: number; total: number }) => void) => {
          listeners.push(cb)
          return { remove }
        }
      ),
    },
  }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => h.platform,
    isPluginAvailable: (name: string) => name === 'AppUpdater',
  },
  registerPlugin: () => h.plugin,
}))

import { installAndroidUpdate, isAndroidUpdaterAvailable } from './android-update'

const APK = {
  url: 'https://github.com/Vakutaghin/bastyon-nextgen/releases/download/v0.11.3/Android-Bastyon-NextGen-0.11.3.apk',
  size: 1000,
  sha256: 'a'.repeat(64),
}

describe('android-update', () => {
  beforeEach(() => {
    h.listeners.length = 0
    h.remove.mockClear()
    h.plugin.download.mockReset()
    h.plugin.install.mockReset()
    h.plugin.addListener.mockClear()
    h.platform = 'android'
  })

  it('плагин есть только в приложении для Android', () => {
    expect(isAndroidUpdaterAvailable()).toBe(true)
    h.platform = 'web'
    expect(isAndroidUpdaterAvailable()).toBe(false)
  })

  it('скачивает с прогрессом, потом отдаёт файл установщику', async () => {
    h.plugin.download.mockImplementation(async () => {
      h.listeners[0]!({ received: 250, total: 1000 })
      h.listeners[0]!({ received: 1000, total: 0 })
      return { path: '/data/user/0/com.bastyon.app/cache/updates/update.apk' }
    })
    h.plugin.install.mockResolvedValue({ status: 'not_installed' })
    const progress: unknown[] = []

    await expect(installAndroidUpdate(APK, (p) => progress.push(p))).resolves.toBe('dismissed')

    expect(h.plugin.download).toHaveBeenCalledWith(APK)
    expect(h.plugin.install).toHaveBeenCalledWith({
      path: '/data/user/0/com.bastyon.app/cache/updates/update.apk',
    })
    expect(progress).toEqual([
      { phase: 'download', fraction: 0 },
      { phase: 'download', fraction: 0.25 },
      { phase: 'download', fraction: null },
      { phase: 'install', fraction: 1 },
    ])
    expect(h.remove).toHaveBeenCalledTimes(1)
  })

  it('не дали разрешение на установку — это не провал', async () => {
    h.plugin.download.mockResolvedValue({ path: '/x/updates/update.apk' })
    h.plugin.install.mockRejectedValue(
      Object.assign(new Error('permission: off'), { code: 'permission' })
    )
    await expect(installAndroidUpdate(APK, () => {})).resolves.toBe('permission')
  })

  it('хеш не сошёлся — ошибка, установщик не открывается, подписка снята', async () => {
    h.plugin.download.mockRejectedValue(Object.assign(new Error('hash: got …'), { code: 'hash' }))
    await expect(installAndroidUpdate(APK, () => {})).rejects.toThrow('hash')
    expect(h.plugin.install).not.toHaveBeenCalled()
    expect(h.remove).toHaveBeenCalledTimes(1)
  })
})
