import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeysStore } from './keys-store'
import type { KeyPair } from '../types/keys'

// ---------------------------------------------------------------------------
// Мокаем все тяжёлые зависимости (крипта/хранилище) — тестируем логику стора.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  generateAddressFromKeyPair: vi.fn(),
  recoverKeyPair: vi.fn(),
  loadBip39Russian: vi.fn().mockResolvedValue(undefined),
  mnemonicToSeed: vi.fn(),
  seedToKeyPair: vi.fn(),
  deriveMessengerKeys: vi.fn(),
  clearKeyCache: vi.fn(),
  saveEncryptedMnemonic: vi.fn(),
  loadEncryptedMnemonic: vi.fn(),
  saveUserAddress: vi.fn(),
  loadAccountsList: vi.fn(),
  addAccountToStore: vi.fn(),
  removeAccountFromStore: vi.fn(),
  getAccountInfo: vi.fn(),
  setCurrentAccount: vi.fn(),
  loadEncryptedData: vi.fn(),
  saveEncryptedData: vi.fn(),
  clearStoredData: vi.fn(),
  deriveAndSaveWalletAddresses: vi.fn(),
}))

vi.mock('../core/addresses', () => ({ generateAddressFromKeyPair: h.generateAddressFromKeyPair }))
vi.mock('../core/keys', () => ({
  recoverKeyPair: h.recoverKeyPair,
  loadBip39Russian: h.loadBip39Russian,
  mnemonicToSeed: h.mnemonicToSeed,
  seedToKeyPair: h.seedToKeyPair,
  deriveMessengerKeys: h.deriveMessengerKeys,
  clearKeyCache: h.clearKeyCache,
}))
vi.mock('../storage', () => ({
  saveEncryptedMnemonic: h.saveEncryptedMnemonic,
  loadEncryptedMnemonic: h.loadEncryptedMnemonic,
  saveUserAddress: h.saveUserAddress,
  loadAccountsList: h.loadAccountsList,
  addAccountToStore: h.addAccountToStore,
  removeAccountFromStore: h.removeAccountFromStore,
  getAccountInfo: h.getAccountInfo,
  setCurrentAccount: h.setCurrentAccount,
  loadEncryptedData: h.loadEncryptedData,
  saveEncryptedData: h.saveEncryptedData,
  clearStoredData: h.clearStoredData,
}))
vi.mock('../wallet-addresses', () => ({ deriveAndSaveWalletAddresses: h.deriveAndSaveWalletAddresses }))
vi.mock('../constants/storage', () => ({ ACCOUNT_STORAGE_PREFIX: 'account_' }))

const KP = { privateKey: Buffer.alloc(32, 1), publicKey: Buffer.alloc(33, 2), ecPair: {} } as unknown as KeyPair

function memStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
}

let warnSpy: ReturnType<typeof vi.spyOn>
let errSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', memStorage())
  Object.values(h).forEach((fn) => fn.mockReset?.())
  h.loadBip39Russian.mockResolvedValue(undefined)
  h.generateAddressFromKeyPair.mockReturnValue({ addressInfo: { address: 'PGenerated' } })
  h.loadAccountsList.mockReturnValue({ success: true, data: { accounts: [], currentAccount: null } })
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  errSpy.mockRestore()
  vi.unstubAllGlobals()
})

describe('setKeyPair / clearKeys / getters', () => {
  it('setKeyPair выставляет keyPair, генерирует и сохраняет адрес', () => {
    const store = useKeysStore()
    store.setKeyPair(KP)

    // Pinia оборачивает state в reactive-proxy → сравниваем по значению.
    expect(store.getKeyPair).toEqual(KP)
    expect(store.getUserAddress).toBe('PGenerated')
    expect(h.saveUserAddress).toHaveBeenCalledWith('PGenerated')
  })

  it('clearKeys обнуляет состояние и чистит кеш ключей', () => {
    const store = useKeysStore()
    store.setKeyPair(KP)
    store.clearKeys()

    expect(store.getKeyPair).toBeNull()
    expect(store.getUserAddress).toBeNull()
    expect(h.clearKeyCache).toHaveBeenCalled()
  })
})

describe('saveMnemonic', () => {
  it('успех — не бросает', async () => {
    h.saveEncryptedMnemonic.mockReturnValue({ success: true })
    await expect(useKeysStore().saveMnemonic('words')).resolves.toBeUndefined()
  })

  it('ошибка — бросает', async () => {
    h.saveEncryptedMnemonic.mockReturnValue({ success: false, error: 'disk' })
    await expect(useKeysStore().saveMnemonic('words')).rejects.toThrow('disk')
  })
})

describe('addAccountForAddress', () => {
  it('сохраняет мнемонику аккаунта и добавляет в список', () => {
    const store = useKeysStore()
    h.saveEncryptedData.mockReturnValue({ success: true })
    h.addAccountToStore.mockReturnValue({ success: true })
    h.loadAccountsList.mockReturnValue({
      success: true,
      data: { accounts: [{ address: 'P1', encryptedMnemonic: '', lastUsed: 1 }], currentAccount: 'P1' },
    })

    store.addAccountForAddress('P1', 'mnemonic words')

    expect(h.saveEncryptedData).toHaveBeenCalledWith('mnemonic words', {
      persistent: true,
      storageKey: 'account_P1',
    })
    expect(h.addAccountToStore).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'P1' })
    )
    expect(store.accountsList?.currentAccount).toBe('P1')
  })

  it('не добавляет, если сохранение мнемоники не удалось', () => {
    const store = useKeysStore()
    h.saveEncryptedData.mockReturnValue({ success: false })

    store.addAccountForAddress('P1', 'words')

    expect(h.addAccountToStore).not.toHaveBeenCalled()
  })
})

describe('addAccountForKey', () => {
  it('шифрует приватный ключ под BST_ACCOUNT_<addr> и добавляет аккаунт', () => {
    const store = useKeysStore()
    h.saveEncryptedData.mockReturnValue({ success: true })
    h.addAccountToStore.mockReturnValue({ success: true })

    store.addAccountForKey('P2', 'L1aWifPrivateKey')

    // Ключ должен быть сохранён (а не потерян) — иначе сессия не переживёт перезагрузку.
    expect(h.saveEncryptedData).toHaveBeenCalledWith('L1aWifPrivateKey', {
      persistent: true,
      storageKey: 'account_P2',
    })
    expect(h.addAccountToStore).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'P2' })
    )
  })

  it('не добавляет аккаунт, если сохранение ключа не удалось', () => {
    const store = useKeysStore()
    h.saveEncryptedData.mockReturnValue({ success: false })

    store.addAccountForKey('P2', 'L1aWifPrivateKey')

    expect(h.addAccountToStore).not.toHaveBeenCalled()
  })
})

describe('getAccountsList / getAccountsInfo', () => {
  it('загружает список из хранилища и кеширует', () => {
    const store = useKeysStore()
    const data = { accounts: [{ address: 'P1', encryptedMnemonic: 'enc', lastUsed: 1 }], currentAccount: 'P1' }
    h.loadAccountsList.mockReturnValue({ success: true, data })

    expect(store.getAccountsList()).toEqual(data)
    // повторно — из кеша, без второго вызова loadAccountsList
    h.loadAccountsList.mockClear()
    store.getAccountsList()
    expect(h.loadAccountsList).not.toHaveBeenCalled()
  })

  it('getAccountsInfo убирает encryptedMnemonic', () => {
    const store = useKeysStore()
    h.loadAccountsList.mockReturnValue({
      success: true,
      data: { accounts: [{ address: 'P1', encryptedMnemonic: 'secret', lastUsed: 1 }], currentAccount: 'P1' },
    })

    const info = store.getAccountsInfo()
    expect(info[0]).not.toHaveProperty('encryptedMnemonic')
    expect(info[0]).toMatchObject({ address: 'P1' })
  })
})

describe('recoverFromAccount', () => {
  it('восстанавливает ключи из мнемоники аккаунта', async () => {
    const store = useKeysStore()
    h.loadEncryptedData.mockReturnValue({ success: true, data: 'acc mnemonic' })
    h.recoverKeyPair.mockReturnValue({ keyPair: KP, format: 'mnemonic', source: 'acc mnemonic' })

    const res = await store.recoverFromAccount('P1')

    expect(res).toEqual({ keyPair: KP, mnemonic: 'acc mnemonic' })
    expect(store.getKeyPair).toEqual(KP)
    expect(h.deriveAndSaveWalletAddresses).toHaveBeenCalledWith('acc mnemonic', 'PGenerated')
    expect(h.setCurrentAccount).toHaveBeenCalledWith('P1')
  })

  it('возвращает null, если мнемоника не найдена', async () => {
    useKeysStore() // pinia init
    h.loadEncryptedData.mockReturnValue({ success: false, data: null })
    expect(await useKeysStore().recoverFromAccount('P1')).toBeNull()
  })

  it('возвращает null, если восстановление ключей не удалось', async () => {
    h.loadEncryptedData.mockReturnValue({ success: true, data: 'm' })
    h.recoverKeyPair.mockReturnValue(null)
    expect(await useKeysStore().recoverFromAccount('P1')).toBeNull()
  })
})

describe('removeAccount', () => {
  it('чистит данные и удаляет из списка → true', () => {
    h.removeAccountFromStore.mockReturnValue({ success: true })
    expect(useKeysStore().removeAccount('P1')).toBe(true)
    expect(h.clearStoredData).toHaveBeenCalledTimes(2) // persistent + session
  })

  it('false, если удаление не удалось', () => {
    h.removeAccountFromStore.mockReturnValue({ success: false })
    expect(useKeysStore().removeAccount('P1')).toBe(false)
  })
})

describe('getMessengerKeys', () => {
  it('использует privateKey из текущей keyPair', async () => {
    const store = useKeysStore()
    store.setKeyPair(KP)
    h.deriveMessengerKeys.mockReturnValue([{ private: 'p', public: 'P' }])

    const keys = await store.getMessengerKeys()

    expect(h.deriveMessengerKeys).toHaveBeenCalledWith(KP.privateKey)
    expect(keys).toEqual([{ private: 'p', public: 'P' }])
  })

  it('без keyPair выводит из сохранённой мнемоники', async () => {
    const store = useKeysStore()
    h.loadEncryptedMnemonic.mockReturnValue({ success: true, data: 'stored mnemonic' })
    h.mnemonicToSeed.mockReturnValue(Buffer.alloc(64, 9))
    h.seedToKeyPair.mockReturnValue({ privateKey: Buffer.alloc(32, 3) })
    h.deriveMessengerKeys.mockReturnValue([{ private: 'p2', public: 'P2' }])

    const keys = await store.getMessengerKeys()

    expect(h.mnemonicToSeed).toHaveBeenCalledWith('stored mnemonic')
    expect(keys).toEqual([{ private: 'p2', public: 'P2' }])
  })

  it('возвращает null, если ключей нет нигде', async () => {
    const store = useKeysStore()
    h.loadEncryptedMnemonic.mockReturnValue({ success: true, data: null })

    expect(await store.getMessengerKeys()).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })
})
