import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { setI18nLocale } from '@/i18n'
import {
  deriveAndSaveWalletAddresses,
  ensureDefaultAdditionalWallet,
  addOneWalletAddress,
} from './wallet-addresses'

// Ошибки деривации резолвятся через i18n; фиксируем 'ru' под русские ассерты.
beforeAll(() => setI18nLocale('ru'))

// ---------------------------------------------------------------------------
// Деривация и storage мокаются — проверяем оркестрацию: откуда берётся ключ
// аккаунта, сколько адресов, перенос списка другой деривации в прежние,
// лимиты и ошибки сохранения. Сами адреса — в wallet-addresses.compat.test.ts.
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  mnemonicToSeed: vi.fn(),
  seedToKeyPair: vi.fn(),
  generateWalletAddress: vi.fn(),
  getWalletList: vi.fn(),
  saveWalletList: vi.fn(),
  getAdditionalList: vi.fn(),
  saveAdditionalList: vi.fn(),
  getLegacyList: vi.fn(),
  saveLegacyList: vi.fn(),
  loadEncryptedData: vi.fn(),
}))

vi.mock('./core/keys/key-generator', () => ({
  mnemonicToSeed: m.mnemonicToSeed,
  seedToKeyPair: m.seedToKeyPair,
}))
vi.mock('./core/addresses/address-generator', () => ({
  generateWalletAddress: m.generateWalletAddress,
}))
vi.mock('./storage', () => ({
  getWalletAddressesList: m.getWalletList,
  saveWalletAddressesList: m.saveWalletList,
  getAdditionalWalletAddressesList: m.getAdditionalList,
  saveAdditionalWalletAddressesList: m.saveAdditionalList,
  getLegacyWalletAddressesList: m.getLegacyList,
  saveLegacyWalletAddressesList: m.saveLegacyList,
  loadEncryptedData: m.loadEncryptedData,
}))
vi.mock('./constants/storage', () => ({ ACCOUNT_STORAGE_PREFIX: 'ACC_' }))

const ADDR = 'PAccount'
const SEED = Buffer.alloc(64, 7)
/** Ключ аккаунта из мнемоники и переданный при входе. */
const MNEMONIC_KEY = Buffer.alloc(32, 1)
const LOGIN_KEY = Buffer.alloc(32, 2)

/** Адрес кошелька i от ключа аккаунта: по первому байту ключа видно, от какого. */
const addr = (key: Buffer, i: number) => `Z${key[0]}_${i}`
const range = (key: Buffer, from: number, to: number) =>
  Array.from({ length: to - from }, (_, k) => addr(key, from + k))

beforeEach(() => {
  vi.clearAllMocks()
  m.mnemonicToSeed.mockReturnValue(SEED)
  m.seedToKeyPair.mockReturnValue({ privateKey: MNEMONIC_KEY })
  m.generateWalletAddress.mockImplementation((i: number, key: Buffer) => ({
    addressInfo: { address: addr(key, i) },
  }))
  m.getWalletList.mockReturnValue([])
  m.saveWalletList.mockReturnValue({ success: true })
  m.getAdditionalList.mockReturnValue([])
  m.saveAdditionalList.mockReturnValue({ success: true })
  m.getLegacyList.mockReturnValue([])
  m.saveLegacyList.mockReturnValue({ success: true })
  m.loadEncryptedData.mockReturnValue({ success: true, data: 'mnemonic words' })
})

describe('deriveAndSaveWalletAddresses', () => {
  it('три адреса от ключа аккаунта из мнемоники, а не от зерна мнемоники', () => {
    const res = deriveAndSaveWalletAddresses('mnemonic', ADDR)

    expect(res).toEqual({ success: true, count: 3 })
    expect(m.seedToKeyPair.mock.calls[0]![1]).toBe("m/44'/0'/0'/0'")
    expect(m.saveWalletList).toHaveBeenCalledWith(ADDR, range(MNEMONIC_KEY, 0, 3))
  })

  it('совпадающий список не перезаписывает', () => {
    m.getWalletList.mockReturnValue(range(MNEMONIC_KEY, 0, 3))
    expect(deriveAndSaveWalletAddresses('mnemonic', ADDR)).toEqual({ success: true, count: 3 })
    expect(m.saveWalletList).not.toHaveBeenCalled()
  })

  it('список прежней деривации заменяет', () => {
    m.getWalletList.mockReturnValue(['Zold0', 'Zold1', 'Zold2'])
    deriveAndSaveWalletAddresses('mnemonic', ADDR)
    expect(m.saveWalletList).toHaveBeenCalledWith(ADDR, range(MNEMONIC_KEY, 0, 3))
  })

  it('возвращает ошибку, если сохранение не удалось', () => {
    m.saveWalletList.mockReturnValue({ success: false, error: 'quota' })
    expect(deriveAndSaveWalletAddresses('mnemonic', ADDR)).toEqual({
      success: false,
      count: 0,
      error: 'quota',
    })
  })

  it('ловит ошибку деривации', () => {
    m.mnemonicToSeed.mockImplementation(() => {
      throw new Error('bad mnemonic')
    })
    expect(deriveAndSaveWalletAddresses('mnemonic', ADDR)).toEqual({
      success: false,
      count: 0,
      error: 'bad mnemonic',
    })
  })
})

describe('ensureDefaultAdditionalWallet', () => {
  it('десять адресов, как в прежнем приложении', async () => {
    expect(await ensureDefaultAdditionalWallet(ADDR)).toEqual({ success: true })
    expect(m.saveAdditionalList).toHaveBeenCalledWith(ADDR, range(MNEMONIC_KEY, 0, 10))
  })

  it('ключ входа важнее мнемоники в хранилище', async () => {
    await ensureDefaultAdditionalWallet(ADDR, new Uint8Array(LOGIN_KEY))
    expect(m.loadEncryptedData).not.toHaveBeenCalled()
    expect(m.saveAdditionalList).toHaveBeenCalledWith(ADDR, range(LOGIN_KEY, 0, 10))
  })

  it('полный список той же деривации не трогает', async () => {
    m.getAdditionalList.mockReturnValue(range(LOGIN_KEY, 0, 10))
    expect(await ensureDefaultAdditionalWallet(ADDR, LOGIN_KEY)).toEqual({ success: true })
    expect(m.saveAdditionalList).not.toHaveBeenCalled()
  })

  it('дополняет список той же деривации до десяти', async () => {
    m.getAdditionalList.mockReturnValue(range(LOGIN_KEY, 0, 3))
    await ensureDefaultAdditionalWallet(ADDR, LOGIN_KEY)
    expect(m.saveAdditionalList).toHaveBeenCalledWith(ADDR, range(LOGIN_KEY, 0, 10))
    expect(m.saveLegacyList).not.toHaveBeenCalled()
  })

  it('список другой деривации (0.3.0–0.13.4) — в прежние, не теряя уже известных', async () => {
    m.getAdditionalList.mockReturnValue(['Zold0', 'Zold1', 'Zold2'])
    m.getLegacyList.mockReturnValue(['Zold0', 'Zolder'])
    await ensureDefaultAdditionalWallet(ADDR, LOGIN_KEY)
    expect(m.saveAdditionalList).toHaveBeenCalledWith(ADDR, range(LOGIN_KEY, 0, 10))
    expect(m.saveLegacyList).toHaveBeenCalledWith(ADDR, ['Zold0', 'Zolder', 'Zold1', 'Zold2'])
  })

  it('без ключа и без мнемоники — ошибка', async () => {
    m.loadEncryptedData.mockReturnValue({ success: false })
    const res = await ensureDefaultAdditionalWallet(ADDR)
    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(m.saveAdditionalList).not.toHaveBeenCalled()
  })

  it('возвращает ошибку сохранения', async () => {
    m.saveAdditionalList.mockReturnValue({ success: false, error: 'quota' })
    expect(await ensureDefaultAdditionalWallet(ADDR, LOGIN_KEY)).toEqual({
      success: false,
      error: 'quota',
    })
  })
})

describe('addOneWalletAddress', () => {
  it('отказывает при достижении лимита (20)', async () => {
    m.getAdditionalList.mockReturnValue(range(LOGIN_KEY, 0, 20))
    const res = await addOneWalletAddress(ADDR, LOGIN_KEY)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/20/)
    expect(m.generateWalletAddress).not.toHaveBeenCalled()
  })

  it('добавляет один адрес по следующему индексу и сохраняет', async () => {
    m.getAdditionalList.mockReturnValue(range(LOGIN_KEY, 0, 10))
    const res = await addOneWalletAddress(ADDR, LOGIN_KEY)
    expect(res).toEqual({ success: true, address: addr(LOGIN_KEY, 10) })
    expect(m.saveAdditionalList).toHaveBeenCalledWith(ADDR, range(LOGIN_KEY, 0, 11))
  })

  it('падает без ключа', async () => {
    m.loadEncryptedData.mockReturnValue({ success: false })
    const res = await addOneWalletAddress(ADDR)
    expect(res.success).toBe(false)
    expect(m.saveAdditionalList).not.toHaveBeenCalled()
  })

  it('возвращает ошибку, если адрес не выведен', async () => {
    m.generateWalletAddress.mockReturnValue({ addressInfo: {} })
    const res = await addOneWalletAddress(ADDR, LOGIN_KEY)
    expect(res.success).toBe(false)
    expect(m.saveAdditionalList).not.toHaveBeenCalled()
  })

  it('возвращает ошибку сохранения', async () => {
    m.saveAdditionalList.mockReturnValue({ success: false, error: 'quota' })
    expect(await addOneWalletAddress(ADDR, LOGIN_KEY)).toEqual({ success: false, error: 'quota' })
  })
})
