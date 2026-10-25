// Адреса кошелька — те же, что у прежнего приложения Bastyon (pocketnet.gui,
// sdk.address.wallet): P2SH-P2WPKH по m/44'/0'/0'/n' от приватного ключа
// аккаунта. Настоящая криптография и localStorage, публичная тестовая
// мнемоника. 0.3.0–0.13.4 выводили их от зерна мнемоники — такие адреса
// уходят в прежние.

import { beforeEach, describe, expect, it } from 'vitest'
import { ensureDefaultAdditionalWallet, deriveAndSaveWalletAddresses } from './wallet-addresses'
import { getAdditionalWalletAddressesList, getLegacyWalletAddressesList } from './storage'
import { getWalletAddressesList, saveAdditionalWalletAddressesList } from './storage'
import { mnemonicToSeed, seedToKeyPair } from './core/keys/key-generator'
import { getMainAddressPath } from './constants/paths'
import { Buffer } from './utils/buffer-polyfill'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const ACCOUNT = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
/** Первые адреса «Кошелька» прежнего приложения для этой мнемоники. */
const OLD_APP = [
  'ZLvWR6TSaeW16E296Hg7z5D3Sh2DuAus7B',
  'ZMAEnwZXhsnvATrqddp93gkUFrWA5anMfJ',
  'ZWFJBVNFp9zE951LhufKsDA9Cnm58grSas',
  'ZLmo837XTgJJYWduj6ULbCfVxfMNy1XUdK',
]
/** Что выводили 0.3.0–0.13.4 (от зерна мнемоники). */
const V7 = [
  'ZNk8Hhfenf18KMPYMdHZiAkoaV9H8CfaiJ',
  'ZGQxTsc1Z5tvW8P9HDRPiGeSkzqtujA1jB',
  'ZNaPNmP7TPBitnj5Uw4wXkVzP3mv9G2zP5',
]

function accountKey(): Uint8Array {
  const seed = Buffer.from(mnemonicToSeed(MNEMONIC, false) as unknown as Uint8Array)
  return seedToKeyPair(seed, getMainAddressPath(0), false).privateKey as unknown as Uint8Array
}

beforeEach(() => {
  localStorage.clear()
})

describe('адреса кошелька прежнего приложения', () => {
  it('дополнительные кошельки — десять адресов прежнего приложения', async () => {
    expect(await ensureDefaultAdditionalWallet(ACCOUNT, accountKey())).toEqual({ success: true })
    const list = getAdditionalWalletAddressesList(ACCOUNT)
    expect(list).toHaveLength(10)
    expect(list.slice(0, 4)).toEqual(OLD_APP)
  })

  it('список 0.3.0–0.13.4 заменяется, его адреса — в прежних', async () => {
    saveAdditionalWalletAddressesList(ACCOUNT, V7)
    await ensureDefaultAdditionalWallet(ACCOUNT, accountKey())
    expect(getAdditionalWalletAddressesList(ACCOUNT).slice(0, 4)).toEqual(OLD_APP)
    expect(getLegacyWalletAddressesList(ACCOUNT)).toEqual(V7)
  })

  it('адреса для мини-приложений — те же', () => {
    deriveAndSaveWalletAddresses(MNEMONIC, ACCOUNT)
    expect(getWalletAddressesList(ACCOUNT)).toEqual(OLD_APP.slice(0, 3))
  })
})
