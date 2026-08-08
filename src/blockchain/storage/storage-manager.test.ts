import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveUserAddress,
  loadUserAddress,
  hasStoredSession,
  saveWasLogged,
  clearAllUserData,
  getWalletAddressesList,
  saveWalletAddressesList,
  getAdditionalWalletAddressesList,
  saveAdditionalWalletAddressesList,
  getWalletLabel,
  setWalletLabel,
} from './storage-manager'
import {
  USER_ADDRESS_STORAGE_KEY,
  WAS_LOGGED_KEY,
  MNEMONIC_STORAGE_KEY,
  WALLET_ADDRESSES_PREFIX,
  ACCOUNT_STORAGE_PREFIX,
  DEVICE_FINGERPRINT_KEY,
  VAULT_ENVELOPE_KEY,
  VAULT_ENVELOPE_BACKUP_KEY,
} from '../constants/storage'
import { ACCOUNTS_LIST_KEY } from './storage-constants'

// clearStoredData (шифрованная мнемоника) мокаем — это отдельный модуль.
const _clearStoredData = vi.hoisted(() => vi.fn())
vi.mock('./storage-keys', () => ({ clearStoredData: _clearStoredData }))

// Тестовое окружение даёт no-op localStorage/sessionStorage — ставим рабочие
// in-memory реализации.
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
  _clearStoredData.mockReset()
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})

afterEach(() => vi.unstubAllGlobals())

describe('user address', () => {
  it('сохраняет и читает адрес', () => {
    saveUserAddress('PUser')
    expect(loadUserAddress()).toBe('PUser')
  })

  it('loadUserAddress возвращает null, если не сохранён', () => {
    expect(loadUserAddress()).toBeNull()
  })
})

describe('hasStoredSession', () => {
  it('false на чистом хранилище', () => {
    expect(hasStoredSession()).toBe(false)
  })

  it('true при наличии списка аккаунтов', () => {
    localStorage.setItem(ACCOUNTS_LIST_KEY, '[]')
    expect(hasStoredSession()).toBe(true)
  })

  it("true при WAS_LOGGED='true'", () => {
    saveWasLogged(true)
    expect(hasStoredSession()).toBe(true)
  })

  it('true при наличии зашифрованной мнемоники', () => {
    localStorage.setItem(MNEMONIC_STORAGE_KEY, 'encrypted')
    expect(hasStoredSession()).toBe(true)
  })

  it('false после saveWasLogged(false) (пустая строка не считается)', () => {
    saveWasLogged(false)
    expect(hasStoredSession()).toBe(false)
  })
})

describe('clearAllUserData', () => {
  it('чистит шифрованные данные (оба стора) и ключи сессии', () => {
    saveUserAddress('PUser')
    saveWasLogged(true)
    localStorage.setItem(ACCOUNTS_LIST_KEY, '[1]')
    sessionStorage.setItem(ACCOUNTS_LIST_KEY, '[1]')

    clearAllUserData()

    expect(_clearStoredData).toHaveBeenCalledWith({ persistent: true })
    expect(_clearStoredData).toHaveBeenCalledWith({ persistent: false })
    expect(localStorage.getItem(USER_ADDRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(WAS_LOGGED_KEY)).toBeNull()
    expect(localStorage.getItem(ACCOUNTS_LIST_KEY)).toBeNull()
    expect(sessionStorage.getItem(ACCOUNTS_LIST_KEY)).toBeNull()
  })

  it('P0-1/P1-12: сносит per-account секреты, fingerprint и артефакты сейфа', () => {
    localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}P1`, 'enc1')
    localStorage.setItem(`${ACCOUNT_STORAGE_PREFIX}P2`, 'enc2')
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, 'fp')
    localStorage.setItem(VAULT_ENVELOPE_KEY, '{}')
    localStorage.setItem(VAULT_ENVELOPE_BACKUP_KEY, '{}')

    clearAllUserData()

    expect(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}P1`)).toBeNull()
    expect(localStorage.getItem(`${ACCOUNT_STORAGE_PREFIX}P2`)).toBeNull()
    expect(localStorage.getItem(DEVICE_FINGERPRINT_KEY)).toBeNull()
    expect(localStorage.getItem(VAULT_ENVELOPE_KEY)).toBeNull()
    expect(localStorage.getItem(VAULT_ENVELOPE_BACKUP_KEY)).toBeNull()
  })
})

describe('wallet addresses list (per-account ключ)', () => {
  it('пустой список, если ничего не сохранено', () => {
    expect(getWalletAddressesList('PAcc')).toEqual([])
  })

  it('round-trip сохранения и чтения', () => {
    saveWalletAddressesList('PAcc', ['w0', 'w1'])
    expect(getWalletAddressesList('PAcc')).toEqual(['w0', 'w1'])
  })

  it('изолирует адреса по аккаунту', () => {
    saveWalletAddressesList('PAcc1', ['a'])
    saveWalletAddressesList('PAcc2', ['b'])
    expect(getWalletAddressesList('PAcc1')).toEqual(['a'])
    expect(getWalletAddressesList('PAcc2')).toEqual(['b'])
  })

  it('фильтрует нестроковые элементы', () => {
    // setItem стора строкоизирует значение, поэтому пишем JSON напрямую по ключу.
    localStorage.setItem(WALLET_ADDRESSES_PREFIX + 'PX', JSON.stringify(['ok', 1, null, 'ok2']))
    expect(getWalletAddressesList('PX')).toEqual(['ok', 'ok2'])
  })

  it('возвращает [] на повреждённом JSON', () => {
    localStorage.setItem(WALLET_ADDRESSES_PREFIX + 'PBad', '{broken')
    expect(getWalletAddressesList('PBad')).toEqual([])
  })

  it('возвращает ошибку, если setItem бросает', () => {
    vi.stubGlobal('localStorage', {
      ...memStorage(),
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    const res = saveWalletAddressesList('PAcc', ['w'])
    expect(res).toEqual({ success: false, error: 'quota exceeded' })
  })
})

describe('additional wallet addresses (общий map-ключ)', () => {
  it('пустой список по умолчанию', () => {
    expect(getAdditionalWalletAddressesList('PAcc')).toEqual([])
  })

  it('round-trip и изоляция по аккаунту в общем map', () => {
    saveAdditionalWalletAddressesList('PAcc1', ['x0'])
    saveAdditionalWalletAddressesList('PAcc2', ['y0', 'y1'])

    expect(getAdditionalWalletAddressesList('PAcc1')).toEqual(['x0'])
    expect(getAdditionalWalletAddressesList('PAcc2')).toEqual(['y0', 'y1'])
  })

  it('обновление одного аккаунта не затирает другой', () => {
    saveAdditionalWalletAddressesList('PAcc1', ['x0'])
    saveAdditionalWalletAddressesList('PAcc2', ['y0'])
    saveAdditionalWalletAddressesList('PAcc1', ['x0', 'x1'])

    expect(getAdditionalWalletAddressesList('PAcc1')).toEqual(['x0', 'x1'])
    expect(getAdditionalWalletAddressesList('PAcc2')).toEqual(['y0'])
  })

  it('фильтрует нестроковые элементы', () => {
    saveAdditionalWalletAddressesList('PAcc', ['ok', 5 as unknown as string, 'ok2'])
    expect(getAdditionalWalletAddressesList('PAcc')).toEqual(['ok', 'ok2'])
  })
})

describe('wallet labels', () => {
  it('возвращает пустую строку, если ярлык не задан', () => {
    expect(getWalletLabel('PAcc', 'W1')).toBe('')
  })

  it('устанавливает и читает ярлык (trim + изоляция по аккаунту/адресу)', () => {
    setWalletLabel('PAcc', 'W1', '  Trading  ')
    expect(getWalletLabel('PAcc', 'W1')).toBe('Trading')
    expect(getWalletLabel('PAcc', 'W2')).toBe('')
    expect(getWalletLabel('PAcc2', 'W1')).toBe('')
  })

  it('пустой ярлык удаляет запись', () => {
    setWalletLabel('PAcc', 'W1', 'X')
    setWalletLabel('PAcc', 'W1', '   ')
    expect(getWalletLabel('PAcc', 'W1')).toBe('')
  })

  it('обрезает ярлык до 40 символов', () => {
    setWalletLabel('PAcc', 'W1', 'a'.repeat(60))
    expect(getWalletLabel('PAcc', 'W1').length).toBe(40)
  })

  it('clearAllUserData снимает ярлыки (изоляция между аккаунтами)', () => {
    setWalletLabel('PAcc', 'W1', 'Trading')
    clearAllUserData()
    expect(getWalletLabel('PAcc', 'W1')).toBe('')
  })
})
