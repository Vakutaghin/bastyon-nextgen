import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@/b-components/video-uploader/utils/environment', () => ({ isTauri: () => true }))
vi.mock('@/i18n', () => ({ t: (k: string) => (k === 'appMsg.bytes.gb' ? 'ГБ' : 'МБ') }))

import { formatLimit, useStorageStore, type StorageUsage } from './storage-store'

const MB = 1024 * 1024

function usage(over: Partial<StorageUsage> = {}): StorageUsage {
  return {
    webCache: 300 * MB,
    ipfsCache: null,
    limits: { web: 512 * MB, ipfs: 2048 * MB },
    modules: { ipfs: 0, tor: 100 * MB, voice: 0, compression: 0, mesh: 2 * MB },
    versions: { ipfs: null, tor: null, compression: null, mesh: null },
    ...over,
  }
}

describe('storage-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    vi.useFakeTimers()
  })

  it('предел подписью — в единицах интерфейса', () => {
    expect(formatLimit(512 * MB)).toBe('512 МБ')
    expect(formatLimit(2048 * MB)).toBe('2 ГБ')
  })

  it('размеры с диска и сумма модулей', async () => {
    invoke.mockResolvedValueOnce(usage())
    const store = useStorageStore()
    await store.refresh()
    expect(invoke).toHaveBeenCalledWith('storage_usage', undefined)
    expect(store.modulesTotal).toBe(102 * MB)
  })

  it('новый предел уходит целиком, с прежним вторым', async () => {
    invoke.mockResolvedValueOnce(usage())
    const store = useStorageStore()
    await store.refresh()
    invoke.mockImplementation(async (cmd: string, args?: { limits?: unknown }) =>
      cmd === 'storage_set_limits'
        ? args?.limits
        : usage({ limits: { web: 250 * MB, ipfs: 2048 * MB } })
    )
    const done = store.setLimit('web', 250 * MB)
    await vi.runAllTimersAsync()
    await done
    expect(invoke).toHaveBeenCalledWith('storage_set_limits', {
      limits: { web: 250 * MB, ipfs: 2048 * MB },
    })
    expect(store.usage?.limits.web).toBe(250 * MB)
  })

  it('очистка: true при успехе, false при ошибке, второй вызов во время первой — отказ', async () => {
    const store = useStorageStore()
    invoke.mockResolvedValue(usage())
    const first = store.clear('web')
    expect(await store.clear('ipfs')).toBe(false)
    await vi.runAllTimersAsync()
    expect(await first).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage_clear', { kind: 'web' })

    invoke.mockRejectedValueOnce(new Error('no main window'))
    expect(await store.clear('web')).toBe(false)
    expect(store.clearing).toBeNull()
  })
})
