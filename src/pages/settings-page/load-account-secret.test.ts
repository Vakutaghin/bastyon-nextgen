// Загрузчик секрета для «Приватного ключа» и проверки бэкапа: свой ключ
// аккаунта важнее общего BST_MNEMONIC, а общий отдаётся только владельцу —
// иначе настройки показали бы сид другого аккаунта (как в свитчере до S10).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEncryptedData: vi.fn(),
  loadEncryptedMnemonic: vi.fn(),
  addressOfSecret: vi.fn(),
  detectPrivateKeyFormat: vi.fn(),
}))
vi.mock('@/blockchain/storage', () => ({
  loadEncryptedData: mocks.loadEncryptedData,
  loadEncryptedMnemonic: mocks.loadEncryptedMnemonic,
}))
vi.mock('@/blockchain', () => ({ detectPrivateKeyFormat: mocks.detectPrivateKeyFormat }))
vi.mock('@/b-components/header/account-switcher/helpers/load-account-mnemonic', () => ({
  addressOfSecret: mocks.addressOfSecret,
}))

import { loadAccountSecret } from './load-account-secret'

const SEED_A =
  'abandon ability able about above absent absorb abstract absurd abuse access accident'
const SEED_B = 'zoo zone zero youth young yellow year yard wrong write worth world'

describe('loadAccountSecret', () => {
  beforeEach(() => {
    mocks.loadEncryptedData.mockReset().mockReturnValue({ success: false })
    mocks.loadEncryptedMnemonic.mockReset().mockReturnValue({ success: true, data: SEED_B })
    mocks.addressOfSecret
      .mockReset()
      .mockImplementation((s: string) => (s === SEED_B ? 'PB' : 'PA'))
    mocks.detectPrivateKeyFormat.mockReset().mockReturnValue('mnemonic')
  })

  it('берёт ключ аккаунта BST_ACCOUNT_<адрес> и не смотрит в общий', async () => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: SEED_A })

    await expect(loadAccountSecret('PA')).resolves.toEqual({ format: 'mnemonic', raw: SEED_A })
    expect(mocks.loadEncryptedData).toHaveBeenCalledWith({
      persistent: true,
      storageKey: 'BST_ACCOUNT_PA',
    })
    expect(mocks.loadEncryptedMnemonic).not.toHaveBeenCalled()
  })

  it('общий секрет чужого адреса не отдаёт', async () => {
    await expect(loadAccountSecret('PA')).resolves.toBeNull()
  })

  it('общий секрет отдаёт его владельцу', async () => {
    await expect(loadAccountSecret('PB')).resolves.toEqual({ format: 'mnemonic', raw: SEED_B })
  })

  it('нерасшифрованный общий секрет — как отсутствующий', async () => {
    mocks.loadEncryptedMnemonic.mockReturnValue({ success: false, error: 'decrypt' })
    await expect(loadAccountSecret('PB')).resolves.toBeNull()
    expect(mocks.addressOfSecret).not.toHaveBeenCalled()
  })

  it('обрезает пробелы вокруг сохранённой строки', async () => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: `  ${SEED_A}\n` })
    await expect(loadAccountSecret('PA')).resolves.toEqual({ format: 'mnemonic', raw: SEED_A })
  })

  it('строка из одних пробелов — секрета нет', async () => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: '   ' })
    mocks.loadEncryptedMnemonic.mockReturnValue({ success: false })
    await expect(loadAccountSecret('PA')).resolves.toBeNull()
  })

  it.each(['hex', 'wif'] as const)('формат %s возвращается как есть', async (format) => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: 'key-material' })
    mocks.detectPrivateKeyFormat.mockReturnValue(format)
    await expect(loadAccountSecret('PA')).resolves.toEqual({ format, raw: 'key-material' })
  })

  it('нераспознанный формат — ошибка unknown-format', async () => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: 'garbage' })
    mocks.detectPrivateKeyFormat.mockReturnValue('unknown')
    await expect(loadAccountSecret('PA')).rejects.toThrow('unknown-format')
  })
})
