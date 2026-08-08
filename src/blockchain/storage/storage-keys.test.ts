import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveEncryptedData,
  loadEncryptedData,
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  clearStoredData,
} from './storage-keys'
import { MNEMONIC_STORAGE_KEY } from '../constants/storage'

// Шифрование — identity (покрыто отдельно), fingerprint — заглушка.
vi.mock('./encryption', () => ({
  encryptData: (d: string) => d,
  decryptData: (d: string) => d,
}))
// P0-1: seam берёт ключ из сейфа. getVaultLegacyKey→null → heal-ветка не активна
// (identity-шифрование и так не бросает). Heal тестируется отдельно.
vi.mock('./vault/crypto-vault', () => ({
  getVaultSecret: () => 'fp',
  getVaultLegacyKey: () => null,
}))

function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('saveEncryptedData / loadEncryptedData', () => {
  it('persistent=true пишет в localStorage в конверте {data,timestamp,version}', () => {
    const res = saveEncryptedData('secret', { persistent: true, storageKey: 'K' })

    expect(res).toMatchObject({ success: true, storageType: 'localStorage' })
    const env = JSON.parse(localStorage.getItem('K')!)
    expect(env).toMatchObject({ data: 'secret', version: '2.0' })
    expect(env.timestamp).toBeTypeOf('number')
  })

  it('по умолчанию (persistent=false) пишет в sessionStorage', () => {
    saveEncryptedData('secret', { storageKey: 'K' })
    expect(sessionStorage.getItem('K')).not.toBeNull()
    expect(localStorage.getItem('K')).toBeNull()
  })

  it('round-trip: load возвращает исходные данные', () => {
    saveEncryptedData('my-mnemonic', { persistent: true, storageKey: 'K' })
    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res).toMatchObject({ success: true, data: 'my-mnemonic' })
  })

  it('load возвращает data:null, если ключа нет', () => {
    const res = loadEncryptedData({ persistent: true, storageKey: 'MISSING' })
    expect(res).toEqual({ success: true, data: null, storageType: 'localStorage' })
  })

  it('load возвращает ошибку на повреждённом JSON', () => {
    localStorage.setItem('K', '{broken')
    const res = loadEncryptedData({ persistent: true, storageKey: 'K' })
    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
  })

  it('save: ошибка, если хранилище недоступно', () => {
    vi.stubGlobal('localStorage', undefined)
    const res = saveEncryptedData('x', { persistent: true })
    expect(res).toEqual({ success: false, error: 'Storage is not available' })
  })
})

describe('saveEncryptedMnemonic / loadEncryptedMnemonic', () => {
  it('сохраняет мнемонику в localStorage под MNEMONIC ключом', () => {
    saveEncryptedMnemonic('twelve words here')
    expect(loadEncryptedData({ persistent: true, storageKey: MNEMONIC_STORAGE_KEY }).data).toBe(
      'twelve words here'
    )
  })

  it('load предпочитает localStorage', () => {
    saveEncryptedMnemonic('from-local')
    expect(loadEncryptedMnemonic().data).toBe('from-local')
  })

  it('load падает обратно на sessionStorage (обратная совместимость)', () => {
    // только в sessionStorage
    saveEncryptedData('from-session', { persistent: false, storageKey: MNEMONIC_STORAGE_KEY })
    const res = loadEncryptedMnemonic()
    expect(res.data).toBe('from-session')
    expect(res.storageType).toBe('sessionStorage')
  })

  it('возвращает data:null, если мнемоники нет нигде', () => {
    expect(loadEncryptedMnemonic().data).toBeNull()
  })
})

describe('clearStoredData', () => {
  it('удаляет данные по ключу из выбранного хранилища', () => {
    saveEncryptedData('x', { persistent: true, storageKey: 'K' })
    clearStoredData({ persistent: true, storageKey: 'K' })
    expect(localStorage.getItem('K')).toBeNull()
  })

  it('для MNEMONIC ключа чистит ОБА хранилища', () => {
    saveEncryptedData('m', { persistent: true, storageKey: MNEMONIC_STORAGE_KEY })
    saveEncryptedData('m', { persistent: false, storageKey: MNEMONIC_STORAGE_KEY })

    clearStoredData({ persistent: true, storageKey: MNEMONIC_STORAGE_KEY })

    expect(localStorage.getItem(MNEMONIC_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(MNEMONIC_STORAGE_KEY)).toBeNull()
  })

  it('не бросает при недоступном хранилище', () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => clearStoredData({ persistent: true, storageKey: 'K' })).not.toThrow()
  })
})
