// S10: общий BST_MNEMONIC как fallback отдаётся только владельцу.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEncryptedData: vi.fn(),
  loadEncryptedMnemonic: vi.fn(),
  recoverKeyPair: vi.fn(),
  generateAddressFromKeyPair: vi.fn(),
}))
vi.mock('@/blockchain/storage', () => ({
  loadEncryptedData: mocks.loadEncryptedData,
  loadEncryptedMnemonic: mocks.loadEncryptedMnemonic,
}))
vi.mock('@/blockchain/core/keys', () => ({ recoverKeyPair: mocks.recoverKeyPair }))
vi.mock('@/blockchain/core/addresses', () => ({
  generateAddressFromKeyPair: mocks.generateAddressFromKeyPair,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/helpers/common/mnemonic-parser', () => ({
  parseMnemonicOrKey: (raw: string) => ({ mnemonic: raw, privateKeyHex: null }),
}))

import { loadAccountMnemonic } from './load-account-mnemonic'

const SEED_B = 'seed of account B'

describe('loadAccountMnemonic (S10)', () => {
  beforeEach(() => {
    mocks.loadEncryptedData.mockReset().mockReturnValue({ success: false })
    mocks.loadEncryptedMnemonic.mockReset().mockReturnValue({ success: true, data: SEED_B })
    mocks.recoverKeyPair.mockReset().mockReturnValue({ keyPair: { id: 'kp' } })
    mocks.generateAddressFromKeyPair.mockReset().mockReturnValue({ addressInfo: { address: 'PB' } })
  })

  it('per-account секрет имеет приоритет', async () => {
    mocks.loadEncryptedData.mockReturnValue({ success: true, data: 'seed of A' })
    await expect(loadAccountMnemonic('PA' as never)).resolves.toMatchObject({
      mnemonic: 'seed of A',
    })
    expect(mocks.loadEncryptedMnemonic).not.toHaveBeenCalled()
  })

  it('общий секрет для чужого адреса не показывается', async () => {
    await expect(loadAccountMnemonic('PA' as never)).rejects.toThrow('accountMsg.noSavedSeedOrKey')
  })

  it('общий секрет отдаётся его владельцу', async () => {
    await expect(loadAccountMnemonic('PB' as never)).resolves.toMatchObject({ mnemonic: SEED_B })
  })

  it('нерасшифровываемый общий секрет — как отсутствующий', async () => {
    mocks.recoverKeyPair.mockImplementation(() => {
      throw new Error('bad mnemonic')
    })
    await expect(loadAccountMnemonic('PB' as never)).rejects.toThrow('accountMsg.noSavedSeedOrKey')
  })
})
