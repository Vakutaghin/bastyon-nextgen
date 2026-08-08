import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveAccountsList,
  loadAccountsList,
  addAccountToStore,
  removeAccountFromStore,
  getAccountInfo,
  updateAccountName,
  setCurrentAccount,
} from './storage-accounts'

// Шифрование заменяем identity-функциями (encryption покрыт отдельно), чтобы
// localStorage хранил читаемый JSON; fingerprint — заглушка.
vi.mock('./encryption', () => ({
  encryptData: (d: string) => d,
  decryptData: (d: string) => d,
}))
// P0-1: seam берёт ключ из сейфа (не fingerprint). Heal-ветка не активна при
// identity-шифровании и getVaultLegacyKey→null.
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

const acc = (address: string, name = address) => ({ address, name })

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('loadAccountsList / saveAccountsList', () => {
  it('пустой список по умолчанию', () => {
    const res = loadAccountsList()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ accounts: [], currentAccount: null })
  })

  it('round-trip сохранения и загрузки', () => {
    const list = { accounts: [acc('P1')], currentAccount: 'P1' }
    expect(saveAccountsList(list).success).toBe(true)
    expect(loadAccountsList().data).toEqual(list)
  })

  it('saveAccountsList: ошибка, если localStorage недоступен', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(saveAccountsList({ accounts: [], currentAccount: null })).toEqual({
      success: false,
      error: 'localStorage is not available',
    })
  })

  it('loadAccountsList: ошибка на повреждённых данных', () => {
    localStorage.setItem('BST_ACCOUNTS_LIST', '{broken json')
    const res = loadAccountsList()
    expect(res.success).toBe(false)
    expect(res.data).toBeNull()
  })
})

describe('addAccountToStore', () => {
  it('добавляет новый аккаунт и делает его текущим', () => {
    addAccountToStore(acc('P1', 'Alice'))
    const { data } = loadAccountsList()
    expect(data!.accounts).toHaveLength(1)
    expect(data!.accounts[0]).toMatchObject({ address: 'P1', name: 'Alice' })
    expect(data!.accounts[0].lastUsed).toBeTypeOf('number')
    expect(data!.currentAccount).toBe('P1')
  })

  it('обновляет существующий аккаунт по address, не дублируя', () => {
    addAccountToStore(acc('P1', 'Alice'))
    addAccountToStore(acc('P1', 'Alice Renamed'))
    const { data } = loadAccountsList()
    expect(data!.accounts).toHaveLength(1)
    expect(data!.accounts[0].name).toBe('Alice Renamed')
  })

  it('добавление второго аккаунта переключает текущий на него', () => {
    addAccountToStore(acc('P1'))
    addAccountToStore(acc('P2'))
    const { data } = loadAccountsList()
    expect(data!.accounts.map((a) => a.address)).toEqual(['P1', 'P2'])
    expect(data!.currentAccount).toBe('P2')
  })
})

describe('removeAccountFromStore', () => {
  it('удаляет аккаунт', () => {
    addAccountToStore(acc('P1'))
    addAccountToStore(acc('P2'))
    removeAccountFromStore('P1')
    const { data } = loadAccountsList()
    expect(data!.accounts.map((a) => a.address)).toEqual(['P2'])
  })

  it('при удалении текущего делает текущим первого оставшегося', () => {
    addAccountToStore(acc('P1'))
    addAccountToStore(acc('P2')) // current = P2
    removeAccountFromStore('P2')
    expect(loadAccountsList().data!.currentAccount).toBe('P1')
  })

  it('при удалении последнего currentAccount = null', () => {
    addAccountToStore(acc('P1'))
    removeAccountFromStore('P1')
    expect(loadAccountsList().data!.currentAccount).toBeNull()
  })
})

describe('getAccountInfo', () => {
  it('возвращает аккаунт по адресу', () => {
    addAccountToStore(acc('P1', 'Alice'))
    expect(getAccountInfo('P1').data).toMatchObject({ address: 'P1', name: 'Alice' })
  })

  it('возвращает null для несуществующего адреса', () => {
    addAccountToStore(acc('P1'))
    expect(getAccountInfo('PX').data).toBeNull()
  })
})

describe('updateAccountName', () => {
  it('обновляет ник', () => {
    addAccountToStore(acc('P1', 'Old'))
    expect(updateAccountName('P1', 'New').success).toBe(true)
    expect(getAccountInfo('P1').data!.name).toBe('New')
  })

  it('ошибка, если аккаунт не найден', () => {
    expect(updateAccountName('PX', 'Name')).toEqual({ success: false, error: 'Account not found' })
  })

  it('no-op (success) при том же нике', () => {
    addAccountToStore(acc('P1', 'Same'))
    expect(updateAccountName('P1', 'Same').success).toBe(true)
    expect(getAccountInfo('P1').data!.name).toBe('Same')
  })
})

describe('setCurrentAccount', () => {
  it('устанавливает текущий аккаунт', () => {
    addAccountToStore(acc('P1'))
    addAccountToStore(acc('P2')) // current = P2
    expect(setCurrentAccount('P1').success).toBe(true)
    expect(loadAccountsList().data!.currentAccount).toBe('P1')
  })

  it('ошибка для несуществующего аккаунта', () => {
    addAccountToStore(acc('P1'))
    expect(setCurrentAccount('PX')).toEqual({ success: false, error: 'Account not found' })
  })
})
