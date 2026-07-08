import { describe, it, expect, beforeEach, vi } from 'vitest'

const ensureVaultReady = vi.fn()
const submitPassphrase = vi.fn()
const getAttemptState = vi.fn(() => ({ attempts: 0, cooldownUntil: 0 }))
const destroyVault = vi.fn(async () => {})

vi.mock('./crypto-vault', () => ({
  ensureVaultReady: () => ensureVaultReady(),
  submitPassphrase: (pw: string) => submitPassphrase(pw),
  getAttemptState: () => getAttemptState(),
  destroyVault: () => destroyVault(),
}))

import {
  ensureVaultUnlocked,
  configureUnlockUi,
  submitUnlockPassphrase,
  requestUnlockReset,
  __resetUnlockForTests,
} from './vault-unlock'

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  __resetUnlockForTests()
  ensureVaultReady.mockReset()
  submitPassphrase.mockReset()
  destroyVault.mockClear()
  getAttemptState.mockReturnValue({ attempts: 0, cooldownUntil: 0 })
})

describe('vault-unlock orchestrator', () => {
  it('passwordless: возвращает unlocked без модалки', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'unlocked', level: 'device' })
    const open = vi.fn()
    configureUnlockUi({ open, close: vi.fn(), hostAvailable: () => true })

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
    configureUnlockUi({ open, close, hostAvailable: () => true })

    const p = ensureVaultUnlocked()
    await flush()
    expect(open).toHaveBeenCalledTimes(1)

    submitPassphrase.mockResolvedValue({ ok: true })
    const res = await submitUnlockPassphrase('correct')
    expect(res.ok).toBe(true)

    const out = await p
    expect(out.status).toBe('unlocked')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('passphrase без host (embed): возвращает needs-passphrase, не вешается', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-passphrase', level: 'passphrase' })
    configureUnlockUi({ open: vi.fn(), close: vi.fn(), hostAvailable: () => false })

    const out = await ensureVaultUnlocked()
    expect(out.status).toBe('needs-passphrase')
  })

  it('reset (забыл пароль): destroyVault + needs-reset', async () => {
    ensureVaultReady.mockResolvedValue({ status: 'needs-passphrase', level: 'passphrase' })
    configureUnlockUi({ open: vi.fn(), close: vi.fn(), hostAvailable: () => true })

    const p = ensureVaultUnlocked()
    await flush()
    requestUnlockReset()

    const out = await p
    expect(destroyVault).toHaveBeenCalledTimes(1)
    expect(out.status).toBe('needs-reset')
  })

  it('storage-unavailable: возвращает как есть, не мемоизирует (ретрай)', async () => {
    ensureVaultReady
      .mockResolvedValueOnce({ status: 'storage-unavailable', level: 'none' })
      .mockResolvedValueOnce({ status: 'unlocked', level: 'device' })
    configureUnlockUi({ open: vi.fn(), close: vi.fn(), hostAvailable: () => true })

    const out1 = await ensureVaultUnlocked()
    expect(out1.status).toBe('storage-unavailable')
    // не мемоизировано → повторный вызов пробует снова и разлочивает
    const out2 = await ensureVaultUnlocked()
    expect(out2.status).toBe('unlocked')
  })
})
