// Замок приложения: закрыто при запуске (кроме сейфа под пароль-фразой),
// код проверяется секретом сейфа, после серии ошибок — пауза без проверки,
// подтверждение перед опасным, «забыли код» по фразе аккаунта с устройства,
// Ctrl+L, выход из всех аккаунтов снимает замок.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const accounts = vi.hoisted(() => ({ list: [] as Array<{ address: string }> }))
vi.mock('@/blockchain/storage/storage-accounts', () => ({
  loadAccountsList: () => ({
    success: true,
    data: { accounts: accounts.list, currentAccount: accounts.list[0]?.address ?? null },
  }),
}))

import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import {
  configureVault,
  ensureInitialized,
  __resetVaultForTests,
} from '@/blockchain/storage/vault/crypto-vault'
import { createMemoryVaultKeyStore } from '@/blockchain/storage/vault/vault-key-store'
import { VAULT_ENVELOPE_KEY } from '@/blockchain/constants/storage'
import { clearAllUserData } from '@/blockchain/storage/storage-manager'
import { recoverKeyPair } from '@/blockchain/core/keys'
import { generateAddressFromKeyPair } from '@/blockchain/core/addresses'
import { readLockAttempts, readLockConfig } from '@/helpers/app-lock/app-lock-config'
import { useAppLockStore } from './app-lock-store'

// Приватный ключ (hex), а не 12 слов: под vitest bip39 отдаёт нативный
// Buffer, который полифилл не признаёт (см. key-recovery.test.ts). Разбор
// фразы — тот же recoverKeyPair, что и для ключа.
const KEY = '11'.repeat(32)
const keyAddress = (): string =>
  generateAddressFromKeyPair(recoverKeyPair(KEY).keyPair).addressInfo.address

beforeEach(async () => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
  vi.stubGlobal('navigator', { locks: undefined })
  __resetVaultForTests()
  configureVault({ keyStore: createMemoryVaultKeyStore() })
  accounts.list = []
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Сейф открыт, как после входа в аккаунт. */
async function openVault(): Promise<void> {
  const out = await ensureInitialized()
  expect(out.status).toBe('unlocked')
}

describe('код', () => {
  it('без замка всё открыто, подтверждение — сразу да', async () => {
    const lock = useAppLockStore()
    expect(lock.enabled).toBe(false)
    expect(lock.locked).toBe(false)
    lock.lock()
    expect(lock.locked).toBe(false)
    await expect(lock.confirm()).resolves.toBe(true)
  })

  it('задали пин-код → «Заблокировать» → неверный не открывает, верный открывает', async () => {
    await openVault()
    const lock = useAppLockStore()
    expect(lock.available()).toBe(true)
    expect(await lock.enable('pin', '2580')).toBe(true)
    expect(lock.enabled).toBe(true)
    expect(lock.kind).toBe('pin')
    expect(lock.digits).toBe(4)
    expect(lock.locked).toBe(false)

    lock.lock()
    expect(lock.locked).toBe(true)
    expect((await lock.unlock('1111')).ok).toBe(false)
    expect(lock.locked).toBe(true)
    expect(readLockAttempts().failures).toBe(1)

    expect((await lock.unlock('2580')).ok).toBe(true)
    expect(lock.locked).toBe(false)
    expect(readLockAttempts().failures).toBe(0)
  })

  it('после пяти ошибок — пауза, и даже верный код не проверяется до её конца', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pattern', '01258')
    lock.lock()
    let last = { ok: true, until: 0 }
    for (let i = 0; i < 5; i++) last = await lock.unlock('0')
    expect(last.ok).toBe(false)
    expect(last.until).toBeGreaterThan(Date.now() + 25_000)

    const paused = await lock.unlock('01258')
    expect(paused).toEqual({ ok: false, until: last.until })
    expect(lock.locked).toBe(true)
  })

  it('смена кода: старый больше не подходит', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pin', '1234')
    await lock.enable('pin', '987654')
    expect(lock.digits).toBe(6)
    expect((await lock.checkCode('1234')).ok).toBe(false)
    expect((await lock.checkCode('987654')).ok).toBe(true)
  })

  it('время автоблокировки сохраняется и переживает смену кода', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pin', '1234')
    lock.setAutoLock('hour1')
    await lock.enable('pattern', '0124')
    expect(readLockConfig()?.autoLock).toBe('hour1')
  })
})

describe('при запуске', () => {
  it('замок задан — закрыто с первого кадра', async () => {
    await openVault()
    await useAppLockStore().enable('pin', '2580')
    setActivePinia(createPinia())
    expect(useAppLockStore().locked).toBe(true)
  })

  it('сейф под пароль-фразой — при запуске вход через неё, код не спрашивается', async () => {
    await openVault()
    await useAppLockStore().enable('pin', '2580')
    localStorage.setItem(
      VAULT_ENVELOPE_KEY,
      JSON.stringify({
        v: 1,
        mode: 'passphrase',
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iter: 1,
        salt: 'AAAA',
        iv: 'AAAA',
        ct: 'AAAA',
      })
    )
    setActivePinia(createPinia())
    expect(useAppLockStore().locked).toBe(false)
  })

  it('сейф пуст (данных нет) — замок снимается сам', async () => {
    await openVault()
    await useAppLockStore().enable('pin', '2580')
    // Как другой запуск: в памяти сейфа ничего, на диске нет ни ключа, ни записей.
    localStorage.removeItem(VAULT_ENVELOPE_KEY)
    localStorage.removeItem('BST_VAULT_BACKUP')
    __resetVaultForTests()
    configureVault({ keyStore: createMemoryVaultKeyStore() })
    setActivePinia(createPinia())
    const lock = useAppLockStore()
    expect(lock.locked).toBe(true)
    const stop = lock.start()
    await vi.waitFor(() => expect(lock.locked).toBe(false))
    stop()
  })

  it('выход из всех аккаунтов стирает замок — после него закрывать нечем', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pin', '2580')
    clearAllUserData()
    lock.lock()
    expect(lock.enabled).toBe(false)
    expect(lock.locked).toBe(false)
  })
})

describe('подтверждение кодом', () => {
  it('ответ окна приходит в confirm()', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pin', '2580')
    const asked = lock.confirm()
    expect(lock.confirmOpen).toBe(true)
    lock.finishConfirm(true)
    await expect(asked).resolves.toBe(true)
    expect(lock.confirmOpen).toBe(false)
  })

  it('замок, закрывшийся поверх окна, отменяет подтверждение', async () => {
    await openVault()
    const lock = useAppLockStore()
    await lock.enable('pin', '2580')
    const asked = lock.confirm()
    lock.lock()
    await expect(asked).resolves.toBe(false)
    expect(lock.confirmOpen).toBe(false)
    expect(lock.locked).toBe(true)
  })
})

describe('забыли код', () => {
  it('ключ аккаунта с этого устройства снимает замок, ничего не стирая', async () => {
    await openVault()
    accounts.list = [{ address: keyAddress() }]
    const lock = useAppLockStore()
    await lock.enable('pin', '2580')
    lock.lock()
    expect(await lock.recover(`  ${KEY}\n`)).toBe('ok')
    expect(lock.locked).toBe(false)
    expect(lock.enabled).toBe(false)
    expect(readLockConfig()).toBeNull()
  })

  it('ключ чужого аккаунта и мусор замок не снимают', async () => {
    await openVault()
    accounts.list = [{ address: 'PSomeOtherAddress' }]
    const lock = useAppLockStore()
    await lock.enable('pin', '2580')
    lock.lock()
    expect(await lock.recover(KEY)).toBe('unknown')
    expect(await lock.recover('просто слова')).toBe('invalid')
    expect(await lock.recover('   ')).toBe('invalid')
    expect(lock.locked).toBe(true)
    expect(lock.enabled).toBe(true)
  })
})

describe('Ctrl+L / Cmd+L', () => {
  it('закрывает, только когда замок задан', async () => {
    await openVault()
    const lock = useAppLockStore()
    const stop = lock.start()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', ctrlKey: true }))
    expect(lock.locked).toBe(false)

    await lock.enable('pin', '2580')
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyL', ctrlKey: true, shiftKey: true })
    )
    expect(lock.locked).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', metaKey: true }))
    expect(lock.locked).toBe(true)
    stop()
  })
})
