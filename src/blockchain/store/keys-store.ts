/**
 * Pinia Store для управления ключами и мульти-аккаунтами
 * Выделен из auth-store для разделения ответственности.
 */

import { defineStore } from 'pinia'
import type { KeyPair, Mnemonic } from '../types/keys'
import type { Address } from '../types/addresses'
import type { AccountInfo, AccountsList } from '../types/auth'
import { generateAddressFromKeyPair } from '../core/addresses'
import {
  recoverKeyPair,
  loadBip39Russian,
  mnemonicToSeed,
  seedToKeyPair,
  deriveMessengerKeys,
  clearKeyCache,
} from '../core/keys'
import {
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  saveUserAddress,
  loadAccountsList,
  addAccountToStore,
  removeAccountFromStore,
  getAccountInfo,
  setCurrentAccount,
  loadEncryptedData,
  saveEncryptedData,
  clearStoredData,
} from '../storage'
import { ACCOUNT_STORAGE_PREFIX } from '../constants/storage'
import { deriveAndSaveWalletAddresses } from '../wallet-addresses'

export const useKeysStore = defineStore('keys', {
  state: () => ({
    keyPair: null as KeyPair | null,
    address: null as Address | null,
    accountsList: null as AccountsList | null,
  }),

  getters: {
    getKeyPair(): KeyPair | null {
      return this.keyPair
    },

    getUserAddress(): Address | null {
      return this.address
    },
  },

  actions: {
    /**
     * Устанавливает ключевую пару и генерирует адрес
     */
    setKeyPair(keyPair: KeyPair): void {
      this.keyPair = keyPair
      const addressResult = generateAddressFromKeyPair(keyPair)
      this.address = addressResult.addressInfo.address
      if (this.address) saveUserAddress(this.address)
    },

    clearKeys(): void {
      this.keyPair = null
      this.address = null
      this.accountsList = null
      clearKeyCache()
    },

    /**
     * Сохраняет мнемоническую фразу в зашифрованном виде
     */
    async saveMnemonic(mnemonic: Mnemonic): Promise<void> {
      const result = saveEncryptedMnemonic(mnemonic)
      if (!result.success) throw new Error(result.error || 'Failed to save mnemonic')
    },

    /**
     * Добавляет аккаунт в хранилище мульти-аккаунтов
     */
    addAccountForAddress(address: Address, mnemonic: string): void {
      const accountMnemonicResult = saveEncryptedData(mnemonic, {
        persistent: true,
        storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
      })

      if (accountMnemonicResult.success) {
        const storage = typeof localStorage !== 'undefined' ? localStorage : null
        const encryptedMnemonic = storage?.getItem(`${ACCOUNT_STORAGE_PREFIX}${address}`) || ''
        const accountInfo: AccountInfo = { address, encryptedMnemonic, lastUsed: Date.now() }
        const addResult = addAccountToStore(accountInfo)
        if (addResult.success) {
          const listResult = loadAccountsList()
          if (listResult.success && listResult.data) this.accountsList = listResult.data
        }
      }
    },

    /**
     * Добавляет аккаунт без мнемоники (вход по приватному ключу)
     */
    addAccountWithoutMnemonic(address: Address): void {
      const accountInfo: AccountInfo = { address, encryptedMnemonic: '', lastUsed: Date.now() }
      const addResult = addAccountToStore(accountInfo)
      if (addResult.success) {
        const listResult = loadAccountsList()
        if (listResult.success && listResult.data) this.accountsList = listResult.data
      }
    },

    getAccountsList(): AccountsList {
      if (this.accountsList) return this.accountsList
      const result = loadAccountsList()
      if (result.success && result.data) {
        this.accountsList = result.data
        return result.data
      }
      return { accounts: [], currentAccount: null }
    },

    getAccountsInfo(): Omit<AccountInfo, 'encryptedMnemonic'>[] {
      const list = this.getAccountsList()
      return list.accounts.map(({ encryptedMnemonic, ...info }) => info)
    },

    /**
     * Восстанавливает ключевую пару из мнемоники аккаунта
     */
    async recoverFromAccount(address: Address): Promise<{ keyPair: KeyPair; mnemonic: string } | null> {
      await loadBip39Russian()
      const mnemonicResult = loadEncryptedData({
        persistent: true,
        storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
      })
      if (!mnemonicResult.success || !mnemonicResult.data) return null

      clearKeyCache()

      const mnemonic = mnemonicResult.data
      const recoveryResult = recoverKeyPair(mnemonic)
      if (!recoveryResult?.keyPair) return null

      this.setKeyPair(recoveryResult.keyPair)
      deriveAndSaveWalletAddresses(mnemonic, this.address!)
      setCurrentAccount(address)

      const listResult = loadAccountsList()
      if (listResult.success && listResult.data) this.accountsList = listResult.data

      return { keyPair: recoveryResult.keyPair, mnemonic }
    },

    /**
     * Удаляет аккаунт из списка
     */
    removeAccount(address: Address): boolean {
      clearStoredData({ persistent: true, storageKey: `account_${address}` })
      clearStoredData({ persistent: false, storageKey: `account_${address}` })
      const result = removeAccountFromStore(address)
      if (result.success) {
        const listResult = loadAccountsList()
        if (listResult.success && listResult.data) this.accountsList = listResult.data
        return true
      }
      return false
    },

    /**
     * Получает ключи для мессенджера (12 ключей)
     */
    async getMessengerKeys(): Promise<{ private: string; public: string }[] | null> {
      try {
        let privateKey: Buffer | null = null

        if (this.keyPair?.privateKey) {
          privateKey = this.keyPair.privateKey
        } else {
          let mnemonic: string | null = null

          if (this.accountsList?.currentAccount) {
            const accountInfoResult = getAccountInfo(this.accountsList.currentAccount)
            if (accountInfoResult.success && accountInfoResult.data) {
              const mnemonicResult = loadEncryptedData({
                persistent: true,
                storageKey: `${ACCOUNT_STORAGE_PREFIX}${accountInfoResult.data.address}`,
              })
              if (mnemonicResult.success) mnemonic = mnemonicResult.data
            }
          }

          if (!mnemonic) {
            const mnemonicResult = loadEncryptedMnemonic()
            if (mnemonicResult.success) mnemonic = mnemonicResult.data
          }

          if (mnemonic) {
            const seed = mnemonicToSeed(mnemonic)
            const mainKeyPair = seedToKeyPair(seed, "m/44'/0'/0'/0/0")
            if (mainKeyPair.privateKey) privateKey = mainKeyPair.privateKey
          }
        }

        if (!privateKey) {
          console.warn('[keys-store] No private key available for messenger keys')
          return null
        }

        return deriveMessengerKeys(privateKey)
      } catch (e) {
        console.error('Failed to generate messenger keys:', e)
        return null
      }
    },
  },
})
