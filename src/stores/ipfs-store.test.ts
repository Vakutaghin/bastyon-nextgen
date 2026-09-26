// Оркестрация модуля IPFS на фронте: отмена установки и то, как стор
// переживает отменённую/упавшую установку.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))
vi.mock('@/stores/tor-store', () => ({ useTorStore: () => ({ shouldTorify: false }) }))

import { useIpfsStore, type IpfsStateSnapshot } from './ipfs-store'
import { IPFS_GATEWAY } from '@/helpers/ipfs/ipfs-viewer'

function snapshot(over: Partial<IpfsStateSnapshot> = {}): IpfsStateSnapshot {
  return {
    status: 'off',
    message: null,
    gateway_port: 0,
    installed: false,
    update_available: false,
    ...over,
  }
}

function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  // Стор решает «десктоп или нет» по глобалам Tauri при создании состояния.
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  setActivePinia(createPinia())
  invoke.mockReset()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  vi.unstubAllGlobals()
})

describe('ipfs-store: отмена установки', () => {
  it('ссылка открывается через публичный шлюз, скачивание прерывается, согласие сброшено', async () => {
    const store = useIpfsStore()
    store.setConsent('accepted')
    // Установка «идёт»: ensure не отвечает, пока её не отменят.
    let finishEnsure: (s: IpfsStateSnapshot) => void = () => {}
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'ipfs_ensure')
        return new Promise<IpfsStateSnapshot>((resolve) => (finishEnsure = resolve))
      if (cmd === 'ipfs_cancel_install') {
        finishEnsure(snapshot({ status: 'off' }))
        return undefined
      }
      return undefined
    })

    const gateway = store.resolveGateway()
    await vi.dynamicImportSettled()
    expect(store.modalPhase).toBe('progress')
    await store.abortInstall()

    await expect(gateway).resolves.toBe(IPFS_GATEWAY)
    expect(invoke).toHaveBeenCalledWith('ipfs_cancel_install', undefined)
    expect(store.consent).toBe('unknown')
    expect(localStorage.getItem('ipfs:consent')).toBe('unknown')
    expect(store.modalOpen).toBe(false)
  })

  it('отменённая установка — не сбой: без паузы, следующий клик снова спросит', async () => {
    const store = useIpfsStore()
    invoke.mockResolvedValue(snapshot({ status: 'off' }))

    await expect(store.ensureRunning()).resolves.toBeNull()

    expect(store.status).toBe('off')
    expect(store._recentlyFailed()).toBe(false)
  })

  it('упавшая установка — сбой с паузой перед следующей попыткой', async () => {
    const store = useIpfsStore()
    invoke.mockRejectedValue('network is unreachable')

    await expect(store.ensureRunning()).resolves.toBeNull()

    expect(store.status).toBe('failed')
    expect(store.message).toBe('network is unreachable')
    expect(store._recentlyFailed()).toBe(true)
  })

  it('прогресс скачивания не застывает после отмены', () => {
    const store = useIpfsStore()
    store.install = { phase: 'downloading', fraction: 0.4, message: '40%' }
    store.applySnapshot(snapshot({ status: 'installing' }))
    expect(store.install).not.toBeNull()
    store.applySnapshot(snapshot({ status: 'off' }))
    expect(store.install).toBeNull()
  })
})
