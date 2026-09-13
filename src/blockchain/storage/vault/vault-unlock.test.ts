import { describe, it, expect, beforeEach, vi } from 'vitest'

const ensureVaultReady = vi.fn()
const submitPassphrase = vi.fn()
const getAttemptState = vi.fn(() => ({ attempts: 0, cooldownUntil: 0 }))
const destroyVault = vi.fn(async () => {})

const clearAllUserData = vi.fn()

vi.mock('./crypto-vault', () => ({
  ensureVaultReady: () => ensureVaultReady(),
  submitPassphrase: (pw: string) => submitPassphrase(pw),
  getAttemptState: () => getAttemptState(),
  destroyVault: () => destroyVault(),
}))
vi.mock('../storage-manager', () => ({
  clearAllUserData: () => clearAllUserData(),
}))

import {
  ensureVaultUnlocked,
  configureUnlockUi,
  submitUnlockPassphrase,
  requestUnlockReset,
  dismissUnlockReset,
  __resetUnlockForTests,
  type UnlockUiBridge,
} from './vault-unlock'

const flush = () => new Promise((r) => setTimeout(r, 0))

function bridge(over: Partial<UnlockUiBridge> = {}): UnlockUiBridge {
  return {
    open: vi.fn(),
    close: vi.fn(),
    hostAvailable: () => true,
    openImport: vi.fn(),
    ...over,
  }
}

beforeEach(() => {
  __resetUnlockForTests()
  ensureVaultReady.mockReset()
  submitPassphrase.mockReset()
  destroyVault.mockClear()
  clearAllUserData.mockClear()
  getAttemptState.mockReturnValue({ attempts: 0, cooldownUntil: 0 })
})

describe('vault-unlock orchestrator', () => {
  it('passwordless: возвращает unlocked без модалки', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'unlocked', level: 'device' })
    const open = vi.fn()
    configureUnlockUi(bridge({ open }))

    const out = await ensureVaultUnlocked()
    expect(out.status).toBe('unlocked')
    expect(open).not.toHaveBeenCalled()
  })

  it('passphrase + host: открывает модалку, верный пароль разлочивает', async () => {
    ensureVaultReady
      .mockResolvedValueOnce({ status: 'needs-passphrase', level: 'passphrase' })
      .mockResolvedValueOnce({ status: 'unlocked', level: 'device' })
    const open = vi.fn()
    const close = vi.fn()
    configureUnlockUi(bridge({ open, close }))

    const p = ensureVaultUnlocked()
    await flush()
    expect(open).toHaveBeenCalledWith('passphrase')

    submitPassphrase.mockResolvedValue({ ok: true })
    const res = await submitUnlockPassphrase('correct')
    expect(res.ok).toBe(true)

    const out = await p
    expect(out.status).toBe('unlocked')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('passphrase без host (embed): возвращает needs-passphrase, не вешается', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-passphrase', level: 'passphrase' })
    configureUnlockUi(bridge({ hostAvailable: () => false }))

    const out = await ensureVaultUnlocked()
    expect(out.status).toBe('needs-passphrase')
  })

  it('reset (забыл пароль): destroyVault + clearAllUserData + импорт, needs-reset', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-passphrase', level: 'passphrase' })
    const openImport = vi.fn()
    configureUnlockUi(bridge({ openImport }))

    const p = ensureVaultUnlocked()
    await flush()
    requestUnlockReset()

    const out = await p
    expect(destroyVault).toHaveBeenCalledTimes(1)
    expect(clearAllUserData).toHaveBeenCalledTimes(1)
    expect(openImport).toHaveBeenCalledTimes(1)
    expect(out.status).toBe('needs-reset')
  })

  it('needs-reset (ключ вытеснен): модалка в фазе reset; подтверждение стирает и открывает импорт', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-reset', level: 'device' })
    const open = vi.fn()
    const close = vi.fn()
    const openImport = vi.fn()
    configureUnlockUi(bridge({ open, close, openImport }))

    const p = ensureVaultUnlocked()
    await flush()
    expect(open).toHaveBeenCalledWith('reset')
    expect(clearAllUserData).not.toHaveBeenCalled() // до подтверждения — ничего не трогаем

    requestUnlockReset()
    const out = await p
    expect(close).toHaveBeenCalledTimes(1)
    expect(destroyVault).toHaveBeenCalledTimes(1)
    expect(clearAllUserData).toHaveBeenCalledTimes(1)
    expect(openImport).toHaveBeenCalledTimes(1)
    expect(out.status).toBe('needs-reset')
  })

  it('needs-reset → «Позже»: ничего не стирается, не мемоизируется (модалка вернётся)', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-reset', level: 'device' })
    const open = vi.fn()
    const openImport = vi.fn()
    configureUnlockUi(bridge({ open, openImport }))

    const p = ensureVaultUnlocked()
    await flush()
    dismissUnlockReset()
    const out = await p
    expect(out.status).toBe('needs-reset')
    expect(destroyVault).not.toHaveBeenCalled()
    expect(clearAllUserData).not.toHaveBeenCalled()
    expect(openImport).not.toHaveBeenCalled()

    // повторный вызов снова показывает модалку (не закэширован «later»)
    const p2 = ensureVaultUnlocked()
    await flush()
    expect(open).toHaveBeenCalledTimes(2)
    dismissUnlockReset()
    await p2
  })

  it('needs-reset без host (embed): возвращает как есть, ничего не стирает', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-reset', level: 'device' })
    configureUnlockUi(bridge({ hostAvailable: () => false }))
    const out = await ensureVaultUnlocked()
    expect(out.status).toBe('needs-reset')
    expect(clearAllUserData).not.toHaveBeenCalled()
  })

  it('storage-unavailable: возвращает как есть, не мемоизирует (ретрай)', async () => {
    ensureVaultReady
      .mockResolvedValueOnce({ status: 'storage-unavailable', level: 'none' })
      .mockResolvedValueOnce({ status: 'unlocked', level: 'device' })
    configureUnlockUi(bridge())

    const out1 = await ensureVaultUnlocked()
    expect(out1.status).toBe('storage-unavailable')
    // не мемоизировано → повторный вызов пробует снова и разлочивает
    const out2 = await ensureVaultUnlocked()
    expect(out2.status).toBe('unlocked')
  })
})
