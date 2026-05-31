import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deriveAndSaveWalletAddresses,
  ensureDefaultAdditionalWallet,
  addOneWalletAddress,
} from './wallet-addresses'

// ---------------------------------------------------------------------------
// Деривация (mnemonicToSeed/generateWalletAddress) и storage мокаются —
// проверяем оркестрацию (лимиты, наличие seed, обработка ошибок сохранения).
// Buffer — глобальный (источник использует bare Buffer.isBuffer/alloc).
// ---------------------------------------------------------------------------

const {
  _mnemonicToSeed,
  _generateWalletAddress,
  _getWalletList,
  _saveWalletList,
  _getAdditionalList,
  _saveAdditionalList,
  _loadEncryptedData,
} = vi.hoisted(() => ({
  _mnemonicToSeed: vi.fn(),
  _generateWalletAddress: vi.fn(),
  _getWalletList: vi.fn(),
  _saveWalletList: vi.fn(),
  _getAdditionalList: vi.fn(),
  _saveAdditionalList: vi.fn(),
  _loadEncryptedData: vi.fn(),
}))

vi.mock('./core/keys/key-generator', () => ({ mnemonicToSeed: _mnemonicToSeed }))
vi.mock('./core/addresses/address-generator', () => ({ generateWalletAddress: _generateWalletAddress }))
vi.mock('./storage', () => ({
  getWalletAddressesList: _getWalletList,
  saveWalletAddressesList: _saveWalletList,
  getAdditionalWalletAddressesList: _getAdditionalList,
  saveAdditionalWalletAddressesList: _saveAdditionalList,
  loadEncryptedData: _loadEncryptedData,
}))
vi.mock('./constants/storage', () => ({ ACCOUNT_STORAGE_PREFIX: 'ACC_' }))

const ADDR = 'PAccount'
const SEED = Buffer.alloc(64, 7)

beforeEach(() => {
  vi.clearAllMocks()
  _mnemonicToSeed.mockReturnValue(SEED)
  _generateWalletAddress.mockImplementation((i: number) => ({
    addressInfo: { address: `WAddr${i}` },
  }))
  _getWalletList.mockReturnValue([])
  _saveWalletList.mockReturnValue({ success: true })
  _getAdditionalList.mockReturnValue([])
  _saveAdditionalList.mockReturnValue({ success: true })
  _loadEncryptedData.mockReturnValue({ success: true, data: 'mnemonic words' })
})

describe('deriveAndSaveWalletAddresses', () => {
  it('ничего не делает, если адресов уже достаточно (>=3)', () => {
    _getWalletList.mockReturnValue(['a', 'b', 'c'])

    const res = deriveAndSaveWalletAddresses('mnemonic', ADDR)

    expect(res).toEqual({ success: true, count: 3 })
    expect(_mnemonicToSeed).not.toHaveBeenCalled()
    expect(_saveWalletList).not.toHaveBeenCalled()
  })

  it('деривирует 3 адреса и сохраняет', () => {
    const res = deriveAndSaveWalletAddresses('mnemonic', ADDR)

    expect(res).toEqual({ success: true, count: 3 })
    expect(_generateWalletAddress).toHaveBeenCalledTimes(3)
    expect(_saveWalletList).toHaveBeenCalledWith(ADDR, ['WAddr0', 'WAddr1', 'WAddr2'])
  })

  it('возвращает ошибку, если сохранение не удалось', () => {
    _saveWalletList.mockReturnValue({ success: false, error: 'disk full' })

    const res = deriveAndSaveWalletAddresses('mnemonic', ADDR)

    expect(res).toEqual({ success: false, count: 0, error: 'disk full' })
  })

  it('ловит ошибку деривации seed', () => {
    _mnemonicToSeed.mockImplementation(() => {
      throw new Error('bad mnemonic')
    })

    const res = deriveAndSaveWalletAddresses('mnemonic', ADDR)

    expect(res).toEqual({ success: false, count: 0, error: 'bad mnemonic' })
  })
})

describe('ensureDefaultAdditionalWallet', () => {
  it('ничего не делает, если уже есть 3 доп. кошелька', async () => {
    _getAdditionalList.mockReturnValue(['x', 'y', 'z'])

    expect(await ensureDefaultAdditionalWallet(ADDR)).toEqual({ success: true })
    expect(_generateWalletAddress).not.toHaveBeenCalled()
  })

  it('деривирует через privateKeyAsSeed (без обращения к хранилищу мнемоники)', async () => {
    const pk = Buffer.alloc(32, 1)

    const res = await ensureDefaultAdditionalWallet(ADDR, pk)

    expect(res).toEqual({ success: true })
    expect(_loadEncryptedData).not.toHaveBeenCalled()
    expect(_saveAdditionalList).toHaveBeenCalledWith(ADDR, ['WAddr0', 'WAddr1', 'WAddr2'])
  })

  it('дополняет существующий список до 3', async () => {
    _getAdditionalList.mockReturnValue(['existing0'])

    await ensureDefaultAdditionalWallet(ADDR, Buffer.alloc(32, 1))

    // деривируются индексы 1 и 2
    expect(_generateWalletAddress).toHaveBeenCalledTimes(2)
    expect(_saveAdditionalList).toHaveBeenCalledWith(ADDR, ['existing0', 'WAddr1', 'WAddr2'])
  })

  it('падает, если нет ни приватного ключа, ни мнемоники в хранилище', async () => {
    _loadEncryptedData.mockReturnValue({ success: false })

    const res = await ensureDefaultAdditionalWallet(ADDR)

    expect(res.success).toBe(false)
    expect(res.error).toContain('Войдите с мнемоникой')
  })

  it('использует мнемонику из хранилища, если приватный ключ не передан', async () => {
    await ensureDefaultAdditionalWallet(ADDR)

    expect(_loadEncryptedData).toHaveBeenCalledWith({
      persistent: true,
      storageKey: `ACC_${ADDR}`,
    })
    expect(_mnemonicToSeed).toHaveBeenCalledWith('mnemonic words', true)
  })
})

describe('addOneWalletAddress', () => {
  it('отказывает при достижении лимита (20)', async () => {
    _getAdditionalList.mockReturnValue(Array.from({ length: 20 }, (_, i) => `w${i}`))

    const res = await addOneWalletAddress(ADDR, Buffer.alloc(32, 1))

    expect(res.success).toBe(false)
    expect(res.error).toContain('Максимум 20')
    expect(_generateWalletAddress).not.toHaveBeenCalled()
  })

  it('добавляет один адрес по следующему индексу и сохраняет', async () => {
    _getAdditionalList.mockReturnValue(['w0', 'w1'])

    const res = await addOneWalletAddress(ADDR, Buffer.alloc(32, 1))

    expect(_generateWalletAddress).toHaveBeenCalledWith(2, expect.anything(), true) // nextIndex = list.length
    expect(res).toEqual({ success: true, address: 'WAddr2' })
    expect(_saveAdditionalList).toHaveBeenCalledWith(ADDR, ['w0', 'w1', 'WAddr2'])
  })

  it('падает без seed', async () => {
    _loadEncryptedData.mockReturnValue({ success: false })

    const res = await addOneWalletAddress(ADDR)

    expect(res.success).toBe(false)
    expect(res.error).toContain('Войдите с мнемоникой')
  })

  it('возвращает ошибку, если адрес не выведен', async () => {
    _generateWalletAddress.mockReturnValue({ addressInfo: undefined })

    const res = await addOneWalletAddress(ADDR, Buffer.alloc(32, 1))

    expect(res).toEqual({ success: false, error: 'Не удалось вывести адрес' })
  })

  it('возвращает ошибку сохранения', async () => {
    _saveAdditionalList.mockReturnValue({ success: false, error: 'quota' })

    const res = await addOneWalletAddress(ADDR, Buffer.alloc(32, 1))

    expect(res).toEqual({ success: false, error: 'quota' })
  })
})
