/**
 * Pinia Store для управления авторизацией через блокчейн
 */

import { defineStore } from 'pinia'
import type {
  UserState,
  SignInResult,
  RegistrationResult,
  SignInOptions,
  RegistrationOptions,
  AccountInfo,
  AccountsList,
} from '../types/auth'
import type { KeyPair, Mnemonic } from '../types/keys'
import type { Address } from '../types/addresses'
import type { UserProfile, GetUserProfileResponse } from '../../types/rpc-responses/user-get'
import type { UserState as UserStateData, GetUserStateResponse } from '../../types/rpc-responses/user-state'

// Импорт модулей
import {
  generateKeys,
  recoverKeyPair,
  loadBip39Russian,
  mnemonicToSeed,
  seedToKeyPair,
  deriveMessengerKeys,
} from '../core/keys'
import { getCryptoKeyPath } from '../constants/paths'
import { generateAddressFromKeyPair } from '../core/addresses'
import {
  saveEncryptedMnemonic,
  loadEncryptedMnemonic,
  saveUserAddress,
  saveWasLogged,
  clearAllUserData,
  loadAccountsList,
  addAccountToStore,
  removeAccountFromStore,
  getAccountInfo,
  setCurrentAccount,
  loadEncryptedData,
  clearStoredData,
  saveEncryptedData,
} from '../storage'
import { ACCOUNT_STORAGE_PREFIX } from '../constants/storage'
import { deriveAndSaveWalletAddresses } from '../wallet-addresses'


export const useAuthStore = defineStore('auth', {
  state: (): UserState & {
    userAvatarUrl: string | null
    accountsList: AccountsList | null
  } => ({
    isAuthenticated: false,
    authState: 'unauthenticated',
    address: null,
    keyPair: null,
    userProfile: null, // Может содержать UserProfile или UserStateData (с лимитами)
    userAvatarUrl: null, // Отдельное поле для URL аватарки (для надежной реактивности)
    isLoading: false,
    error: null,
    // Флаг для отслеживания выполнения запроса fetchUserState
    isFetchingUserState: false,
    // Список аккаунтов для мульти-аккаунтов
    accountsList: null,
  }),

  getters: {
    /**
     * Проверяет, авторизован ли пользователь
     */
    isUserAuthenticated(): boolean {
      return this.isAuthenticated && this.authState === 'authenticated'
    },

    /**
     * Получает адрес пользователя
     */
    getUserAddress(): Address | null {
      return this.address
    },

    /**
     * Получает ключевую пару (только для чтения)
     */
    getKeyPair(): KeyPair | null {
      return this.keyPair
    },

    /**
     * Проверяет, загружаются ли данные
     */
    isAuthLoading(): boolean {
      return this.isLoading
    },

    /**
     * Получает ошибку авторизации
     */
    getAuthError(): string | null {
      return this.error
    },

    /**
     * Получает профиль пользователя
     * Может содержать UserProfile или UserStateData (если загружен через getuserstate)
     */
    getUserProfile(): UserProfile | UserStateData | null {
      return this.userProfile
    },

    /**
     * Получает URL аватарки пользователя
     * Возвращает полный URL или null
     */
    getUserAvatarUrl(): string | null {
      // Сначала проверяем отдельное поле
      if (this.userAvatarUrl) {
        return this.userAvatarUrl
      }
      // Fallback на поле 'i' из профиля
      const profile = this.userProfile
      if (profile && (profile as any).i) {
        return (profile as any).i
      }
      return null
    },

    /**
     * Получает состояние пользователя с лимитами (если загружено через getuserstate)
     */
    getUserState(): UserStateData | null {
      // Проверяем, есть ли поля состояния (лимиты)
      const profile = this.userProfile
      if (profile && ('score_unspent' in profile || 'post_unspent' in profile)) {
        return profile as UserStateData
      }
      return null
    },

    /**
     * Проверяет, есть ли лимиты в профиле (т.е. загружен через getuserstate)
     */
    hasUserState(): boolean {
      // Проверяем напрямую, есть ли поля состояния (лимиты) в профиле
      const profile = this.userProfile
      if (profile && ('score_unspent' in profile || 'post_unspent' in profile)) {
        return true
      }
      return false
    },
  },

  actions: {
    /**
     * Устанавливает состояние загрузки
     */
    setLoading(loading: boolean): void {
      this.isLoading = loading
    },

    /**
     * Устанавливает ошибку
     */
    setError(error: string | null): void {
      this.error = error
      if (error) {
        this.authState = 'error'
      }
    },

    /**
     * Очищает ошибку
     */
    clearError(): void {
      this.error = null
      if (this.isAuthenticated) {
        this.authState = 'authenticated'
      } else {
        this.authState = 'unauthenticated'
      }
    },

    /**
     * Сбрасывает состояние авторизации при ошибке регистрации
     * Используется когда регистрация началась, но не завершилась успешно
     */
    resetAuthOnRegistrationError(): void {
      this.isAuthenticated = false
      this.authState = 'unauthenticated'
      this.address = null
      this.keyPair = null
      // Не очищаем userProfile и другие данные, так как они могут быть из предыдущей сессии
    },

    /**
     * Устанавливает ключевую пару и генерирует адрес
     */
    setKeyPair(keyPair: KeyPair): void {
      this.keyPair = keyPair

      // Генерируем адрес из ключевой пары
      const addressResult = generateAddressFromKeyPair(keyPair)
      this.address = addressResult.addressInfo.address

      // Сохраняем адрес
      if (this.address) {
        saveUserAddress(this.address)
      }
    },

    /**
     * Регистрация нового пользователя
     * Генерирует новую мнемоническую фразу и ключевую пару
     */
    async register(options: RegistrationOptions = {}): Promise<RegistrationResult> {
      const { generateNew = true, saveAfterRegistration = false } = options

      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      try {
        // Убеждаемся, что поддержка русского языка загружена
        await loadBip39Russian()

        // Генерируем новые ключи
        const keyGeneration = generateKeys()
        const { mnemonic, keyPair } = keyGeneration

        // Генерируем адрес
        const addressResult = generateAddressFromKeyPair(keyPair)
        const address = addressResult.addressInfo.address

        // Устанавливаем состояние
        this.setKeyPair(keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        // Деривируем и сохраняем адреса кошелька (как в старом приложении)
        if (this.address) {
          deriveAndSaveWalletAddresses(mnemonic, this.address)
        }

        // Сохраняем если нужно
        if (saveAfterRegistration) {
          await this.saveMnemonic(mnemonic)

          // Добавляем аккаунт в список мульти-аккаунтов
          if (this.address) {
            // Сохраняем зашифрованную мнемонику отдельно для этого аккаунта
            const accountMnemonicResult = saveEncryptedData(mnemonic, {
              persistent: true,
              storageKey: `${ACCOUNT_STORAGE_PREFIX}${this.address}`,
            })

            if (accountMnemonicResult.success) {
              // Получаем зашифрованную строку из хранилища
              const storage = typeof localStorage !== 'undefined' ? localStorage : null

              const encryptedMnemonic = storage?.getItem(`${ACCOUNT_STORAGE_PREFIX}${this.address}`) || ''

              const accountInfo: AccountInfo = {
                address: this.address,
                encryptedMnemonic,
                lastUsed: Date.now(),
              }

              // Добавляем в список аккаунтов
              const addResult = addAccountToStore(accountInfo)
              if (addResult.success) {
                // Обновляем локальный список
                const listResult = loadAccountsList()
                if (listResult.success && listResult.data) {
                  this.accountsList = listResult.data
                }
              }
            }
          }
        }

        // Обновляем ленту и мессенджер
        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(true).catch(() => {})

        this.setLoading(false)

        return {
          mnemonic,
          address,
          keyPair,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Registration failed'
        // При ошибке регистрации сбрасываем статус авторизации
        this.isAuthenticated = false
        this.authState = 'unauthenticated'
        this.address = null
        this.keyPair = null
        this.setError(errorMessage)
        this.setLoading(false)
        throw error
      }
    },

    /**
     * Вход пользователя
     * Восстанавливает ключи из мнемоники или приватного ключа
     */
    async signIn(options: SignInOptions): Promise<SignInResult> {
      const { privateKey } = options

      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      try {
        // Убеждаемся, что поддержка русского языка загружена
        await loadBip39Russian()

        // Валидация входных данных
        if (!privateKey || typeof privateKey !== 'string') {
          throw new Error('Private key is required')
        }

        const trimmedKey = privateKey.trim()

        if (!trimmedKey) {
          throw new Error('Private key cannot be empty')
        }

        // Восстанавливаем ключевую пару
        const recoveryResult = recoverKeyPair(trimmedKey)

        if (!recoveryResult || !recoveryResult.keyPair) {
          throw new Error('Failed to recover key pair from private key')
        }

        // Устанавливаем ключевую пару и адрес
        this.setKeyPair(recoveryResult.keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        // Сохраняем мнемонику (если это мнемоника)
        if (recoveryResult.format === 'mnemonic') {
          await this.saveMnemonic(trimmedKey)
          // Деривируем и сохраняем адреса кошелька (по умолчанию 3)
          if (this.address) {
            deriveAndSaveWalletAddresses(trimmedKey, this.address)
          }
        }

        // Сохраняем флаг "был авторизован"
        saveWasLogged(true)

        // Добавляем аккаунт в список мульти-аккаунтов
        if (this.address) {
          // Сохраняем зашифрованную мнемонику отдельно для этого аккаунта
          const accountMnemonicResult = saveEncryptedData(trimmedKey, {
            persistent: true,
            storageKey: `${ACCOUNT_STORAGE_PREFIX}${this.address}`,
          })

          if (accountMnemonicResult.success) {
            // Получаем зашифрованную строку из хранилища
            const storage = typeof localStorage !== 'undefined' ? localStorage : null

            const encryptedMnemonic = storage?.getItem(`${ACCOUNT_STORAGE_PREFIX}${this.address}`) || ''

            const accountInfo: AccountInfo = {
              address: this.address,
              encryptedMnemonic,
              lastUsed: Date.now(),
            }

            // Добавляем в список аккаунтов
            const addResult = addAccountToStore(accountInfo)
            if (addResult.success) {
              // Обновляем локальный список
              const listResult = loadAccountsList()
              if (listResult.success && listResult.data) {
                this.accountsList = listResult.data
              }
            }
          }
        }

        // Загружаем данные пользователя после успешного входа
        // Используем getuserstate для получения полной информации (профиль + лимиты)
        if (this.address) {
          await this.fetchUserState()
        }

        // Обновляем ленту и мессенджер
        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(true).catch(() => {})

        this.setLoading(false)

        return {
          success: true,
          address: this.address || undefined,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Sign in failed'
        this.setError(errorMessage)
        this.setLoading(false)
        this.isAuthenticated = false
        this.authState = 'error'

        return {
          success: false,
          error: errorMessage,
        }
      }
    },

    /**
     * Выход пользователя
     * Очищает все данные авторизации
     */
    async signOut(): Promise<void> {
      this.setLoading(true)

      try {
        // Очищаем состояние
        this.isAuthenticated = false
        this.authState = 'unauthenticated'
        this.address = null
        this.keyPair = null
        this.userProfile = null
        this.userAvatarUrl = null
        this.error = null
        // Очищаем список аккаунтов в памяти
        this.accountsList = null

        // Очищаем хранилище
        clearAllUserData()

        // Обновляем ленту (чтобы показать общую ленту вместо персональной)
        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(false).catch(() => {})

        this.setLoading(false)
      } catch (error) {
        // Даже при ошибке очищаем состояние
        this.isAuthenticated = false
        this.authState = 'unauthenticated'
        this.address = null
        this.keyPair = null
        this.userProfile = null
        this.userAvatarUrl = null
        this.accountsList = null
        this.setLoading(false)
      }
    },

    /**
     * Восстанавливает сессию из хранилища
     */
    async restoreSession(): Promise<boolean> {
      this.setLoading(true)
      this.setError(null)

      try {
        // Убеждаемся, что поддержка русского языка загружена
        await loadBip39Russian()

        // Загружаем список аккаунтов
        const accountsListResult = loadAccountsList()
        if (accountsListResult.success && accountsListResult.data) {
          this.accountsList = accountsListResult.data
        }

        // Если есть текущий аккаунт в списке, используем его
        if (this.accountsList?.currentAccount) {
          const accountInfoResult = getAccountInfo(this.accountsList.currentAccount)
          if (accountInfoResult.success && accountInfoResult.data) {
            const accountInfo = accountInfoResult.data

            // Загружаем мнемонику для этого аккаунта
            const mnemonicResult = loadEncryptedData({
              persistent: true,
              storageKey: `${ACCOUNT_STORAGE_PREFIX}${accountInfo.address}`,
            })

            if (mnemonicResult.success && mnemonicResult.data) {
              const mnemonic = mnemonicResult.data

              // Восстанавливаем ключи
              const recoveryResult = recoverKeyPair(mnemonic)

              if (recoveryResult && recoveryResult.keyPair) {
                // Устанавливаем ключевую пару и адрес
                this.setKeyPair(recoveryResult.keyPair)
                this.isAuthenticated = true
                this.authState = 'authenticated'

                // Деривируем и сохраняем адреса кошелька (по умолчанию 3)
                if (this.address) {
                  deriveAndSaveWalletAddresses(mnemonic, this.address)
                }

                // Загружаем данные пользователя после восстановления сессии
                if (this.address) {
                  // Загружаем асинхронно, не блокируя восстановление сессии
                  this.fetchUserState().catch(() => {
                    // Игнорируем ошибки при восстановлении сессии
                  })
                }

                this.setLoading(false)
                return true
              }
            }
          }
        }

        // Fallback: старая логика для обратной совместимости

        // Загружаем мнемонику
        const mnemonicResult = loadEncryptedMnemonic()

        if (!mnemonicResult.success || !mnemonicResult.data) {
          this.setLoading(false)
          return false
        }

        const mnemonic = mnemonicResult.data

        // Восстанавливаем ключи
        let recoveryResult
        try {
          recoveryResult = recoverKeyPair(mnemonic)
        } catch (error) {
          console.error('[auth-store] Failed to recover key pair:', error)
          this.setError(
            error instanceof Error ? error.message : 'Failed to recover key pair'
          )
          this.setLoading(false)
          return false
        }

        if (!recoveryResult || !recoveryResult.keyPair) {
          console.error('[auth-store] Recovery result is invalid:', recoveryResult)
          this.setError('Failed to recover key pair: invalid result')
          this.setLoading(false)
          return false
        }

        // Устанавливаем ключевую пару и адрес
        this.setKeyPair(recoveryResult.keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        // Деривируем и сохраняем адреса кошелька (как в старом приложении)
        if (this.address) {
          deriveAndSaveWalletAddresses(mnemonic, this.address)
        }

        // Загружаем данные пользователя после восстановления сессии
        // Используем getuserstate для получения полной информации (профиль + лимиты)
        if (this.address) {
          // Загружаем асинхронно, не блокируя восстановление сессии
          this.fetchUserState().catch(() => {
            // Игнорируем ошибки при восстановлении сессии
          })
        }

        this.setLoading(false)
        return true
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to restore session'
        this.setError(errorMessage)
        this.setLoading(false)
        return false
      }
    },

    /**
     * Сохраняет мнемоническую фразу в зашифрованном виде
     */
    async saveMnemonic(mnemonic: Mnemonic): Promise<void> {
      const result = saveEncryptedMnemonic(mnemonic)
      if (!result.success) {
        throw new Error(result.error || 'Failed to save mnemonic')
      }
    },

    /**
     * Валидирует состояние авторизации
     * Проверяет, что ключи и адрес валидны
     */
    validateAuth(): boolean {
      if (!this.isAuthenticated) {
        return false
      }

      if (!this.keyPair || !this.address) {
        return false
      }

      // Проверяем, что адрес валиден
      if (typeof this.address !== 'string' || this.address.length === 0) {
        return false
      }

      return true
    },

    /**
     * Проверяет, является ли адрес адресом текущего пользователя
     */
    isItMe(address: Address | null): boolean {
      if (!address || !this.address) {
        return false
      }
      return this.address === address
    },

    /**
     * Получает список всех аккаунтов
     */
    getAccountsList(): AccountsList {
      if (this.accountsList) {
        return this.accountsList
      }
      const result = loadAccountsList()
      if (result.success && result.data) {
        this.accountsList = result.data
        return result.data
      }
      return { accounts: [], currentAccount: null }
    },

    /**
     * Получает информацию об аккаунтах (без зашифрованных данных)
     */
    getAccountsInfo(): Omit<AccountInfo, 'encryptedMnemonic'>[] {
      const accountsList = this.getAccountsList()

      return accountsList.accounts.map((acc) => {
        const { encryptedMnemonic, ...info } = acc
        return info
      })
    },

    /**
     * Переключается на другой аккаунт
     */
    async switchAccount(address: Address): Promise<SignInResult> {
      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      try {
        // Очищаем старые данные профиля перед переключением
        this.userProfile = null
        this.userAvatarUrl = null
        this.isFetchingUserState = false

        // Получаем информацию об аккаунте
        const accountInfoResult = getAccountInfo(address)

        if (!accountInfoResult.success || !accountInfoResult.data) {
          throw new Error('Account not found')
        }

        // Загружаем мнемонику для этого аккаунта
        const mnemonicResult = loadEncryptedData({
          persistent: true,
          storageKey: `${ACCOUNT_STORAGE_PREFIX}${address}`,
        })

        if (!mnemonicResult.success || !mnemonicResult.data) {
          throw new Error('Failed to load account mnemonic')
        }

        const mnemonic = mnemonicResult.data

        // Восстанавливаем ключи
        const recoveryResult = recoverKeyPair(mnemonic)

        if (!recoveryResult || !recoveryResult.keyPair) {
          throw new Error('Failed to recover key pair')
        }

        // Устанавливаем ключевую пару и адрес
        this.setKeyPair(recoveryResult.keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        // Деривируем и сохраняем адреса кошелька для этого аккаунта
        if (this.address) {
          deriveAndSaveWalletAddresses(mnemonic, this.address)
        }

        // Устанавливаем как текущий аккаунт
        setCurrentAccount(address)

        // Обновляем локальный список
        const listResult = loadAccountsList()
        if (listResult.success && listResult.data) {
          this.accountsList = listResult.data
        }

        // Загружаем данные пользователя (принудительно, игнорируя кеш)
        if (this.address) {
          // Сбрасываем флаг, чтобы загрузить данные заново
          this.isFetchingUserState = false
          await this.fetchUserState()
        }

        // Обновляем ленту и мессенджер
        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(true).catch(() => {})

        this.setLoading(false)

        return {
          success: true,
          address: this.address || undefined,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to switch account'
        this.setError(errorMessage)
        this.setLoading(false)
        this.isAuthenticated = false
        this.authState = 'error'

        return {
          success: false,
          error: errorMessage,
        }
      }
    },

    /**
     * Удаляет аккаунт из списка
     */
    async removeAccount(address: Address): Promise<boolean> {
      try {
        // Удаляем зашифрованную мнемонику аккаунта
        clearStoredData({ persistent: true, storageKey: `account_${address}` })
        clearStoredData({ persistent: false, storageKey: `account_${address}` })

        // Удаляем из списка
        const result = removeAccountFromStore(address)
        if (result.success) {
          // Обновляем локальный список
          const listResult = loadAccountsList()
          if (listResult.success && listResult.data) {
            this.accountsList = listResult.data

            // Если список аккаунтов пуст, полностью очищаем данные
            if (!this.accountsList.accounts || this.accountsList.accounts.length === 0) {
              this.accountsList = null
              // Очищаем все данные пользователя
              clearAllUserData()
            }
          }

          // Если удалили текущий аккаунт
          if (this.address === address) {
            // Если есть другие аккаунты, переключаемся на первый доступный
            if (this.accountsList && this.accountsList.accounts && this.accountsList.accounts.length > 0) {
              const nextAccount = this.accountsList.accounts[0]
              if (nextAccount && nextAccount.address) {
                await this.switchAccount(nextAccount.address)
              } else {
                // Если нет доступных аккаунтов, выходим полностью
                await this.signOut()
              }
            } else {
              // Если это был последний аккаунт, выходим полностью
              await this.signOut()
            }
          }

          return true
        }

        return false
      } catch (error) {
        return false
      }
    },

    /**
     * Получает ключи для мессенджера (12 ключей)
     */
    async getMessengerKeys(): Promise<{ private: string, public: string }[] | null> {
      try {
        // Используем приватный ключ текущего аккаунта как seed для генерации ключей мессенджера
        // Это соответствует логике bastyon-chat: bitcoin.bip32.fromSeed(privateKey).derivePath(...)

        let privateKey: Buffer | null = null

        if (this.keyPair && this.keyPair.privateKey) {
          privateKey = this.keyPair.privateKey
        } else {
            // Если ключей нет в стейте, пробуем восстановить из мнемоники (как было раньше)
            // Но лучше полагаться на state, так как при логине keyPair устанавливается
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
                // Если есть мнемоника, восстанавливаем основной ключ
                const seed = mnemonicToSeed(mnemonic)
                // Основной ключ обычно по пути m/44'/0'/0'/0/0
                const mainKeyPair = seedToKeyPair(seed, "m/44'/0'/0'/0/0")
                if (mainKeyPair.privateKey) {
                    privateKey = mainKeyPair.privateKey
                }
            }
        }

        if (!privateKey) {
            console.warn('[auth-store] No private key available for messenger keys')
            return null
        }

        return deriveMessengerKeys(privateKey)
      } catch (e) {
        console.error('Failed to generate messenger keys:', e)
        return null
      }
    },

    /**
     * Сбрасывает состояние мессенджера
     * @param relogin Если true, пытается авторизоваться заново
     */
    async resetMessenger(relogin: boolean = false): Promise<void> {
      try {
        const { useMessengerStore } = await import('@/b-components/messenger/store')
        const messengerStore = useMessengerStore()

        messengerStore.logout()

        if (relogin) {
          // Инициализируем матрикс заново (авторизация с новыми ключами)
          // Не блокируем выполнение
          messengerStore.initMatrix().catch((e: any) => {
            console.error('[auth-store] Failed to re-init matrix:', e)
          })
        }
      } catch (e) {
        console.error('[auth-store] Failed to reset messenger:', e)
      }
    },

    /**
     * Инвалидирует все запросы
     */
    async invalidateAllQueries(): Promise<void> {
      try {
        const { queryClient } = await import('../../query-client')
        await queryClient.invalidateQueries()
      } catch (e) {
        console.warn('[auth-store] Failed to invalidate all queries', e)
      }
    },

    /**
     * Инвалидирует кэш ленты новостей
     * Используется при смене аккаунта для обновления ленты
     */
    async invalidateFeed(): Promise<void> {
      try {
        const { queryClient } = await import('../../query-client')
        // Инвалидируем все запросы, связанные с иерархической лентой
        await queryClient.invalidateQueries({ queryKey: ['feed', 'hierarchical-strip'] })
      } catch (e) {
        // Игнорируем ошибки (например, если queryClient еще не инициализирован)
        console.warn('[auth-store] Failed to invalidate feed queries', e)
      }
    },

    /**
     * Загружает полное состояние пользователя через getuserstate
     *
     * ВАЖНО: Используйте этот метод для получения собственных данных при загрузке приложения!
     *
     * Включает:
     * - Все данные профиля (имя, аватар, описание, статистика)
     * - Лимиты пользователя (score_unspent/spent, post_unspent/spent, comment_unspent/spent)
     * - Триальный период (trial)
     *
     * Отличия от fetchUserProfile:
     * - Требует авторизации (подпись запроса)
     * - Не требует передачи адреса (возвращает состояние текущего пользователя)
     * - Включает лимиты и состояние
     *
     * Используется для:
     * - Загрузки данных при входе/восстановлении сессии
     * - Проверки лимитов перед действиями (создание поста, лайк)
     * - Отображения полной информации о текущем пользователе
     *
     * @deprecated Для новых компонентов используйте useFullUserState или useUserState из @/composables
     *
     * @returns Состояние пользователя (UserStateData) или null
     */
    async fetchUserState(): Promise<UserStateData | null> {
      if (!this.address) {
        return null
      }

      // Если запрос уже выполняется, не делаем дублирующий запрос
      if (this.isFetchingUserState) {
        return null
      }

      // Если данные уже загружены для этого адреса, не делаем повторный запрос
      // Проверяем, что профиль соответствует текущему адресу
      if (this.hasUserState) {
        const profile = this.userProfile
        if (profile && ('score_unspent' in profile || 'post_unspent' in profile)) {
          // Проверяем, что профиль соответствует текущему адресу
          const profileAddress = (profile as any).address
          if (profileAddress === this.address) {
            return profile as UserStateData
          }
          // Если адрес не совпадает, очищаем профиль и загружаем заново
          this.userProfile = null
          this.userAvatarUrl = null
        }
      }

      this.isFetchingUserState = true
      this.setLoading(true)
      this.setError(null)

      try {
        // Делаем запросы напрямую (не через Vue Query, так как это action в store)
        // Vue Query composables должны использоваться в компонентах
        const { rpcEndpoints } = await import('../../helpers/api/rpc-endpoints')
        const { getByPRCWithAuth } = await import('../../helpers/api/request')

        // Всегда делаем оба запроса параллельно для получения максимально полных данных
        // getuserstate - для лимитов и состояния
        // getuserprofile - для полного профиля (имя, аватар, описание и т.д.)
        // Добавляем cachehash для обхода кэша и получения актуального баланса
        const cachehash = Date.now().toString(36) + Math.random().toString(36).substr(2)

        const [stateResponse, profileResponse] = await Promise.all([
          // getuserstate - лимиты и состояние
          getByPRCWithAuth({
            method: rpcEndpoints.getUserState,
            parameters: [[this.address]], // getuserstate принимает массив с адресом пользователя
            cachehash,
            options: {
              auth: true,
            },
          }) as Promise<GetUserStateResponse>,

          // getuserprofile - полный профиль
          getByPRCWithAuth({
            method: rpcEndpoints.getUserProfile,
            parameters: [[this.address]],
            cachehash,
            options: {
              auth: true,
            },
          }) as Promise<GetUserProfileResponse>
        ])


        // Сохраняем в кэш Vue Query для будущих использований composables
        try {
          // Используем глобальный queryClient из main.js
          const { queryClient } = await import('../../query-client')
          const stateQueryKey = ['user', 'state', this.address]
          const profileQueryKey = ['user', 'current-profile', this.address]

          if (stateResponse) {
            queryClient.setQueryData(stateQueryKey, stateResponse)
          }
          if (profileResponse) {
            queryClient.setQueryData(profileQueryKey, profileResponse)
          }
        } catch (queryError) {
          // Игнорируем ошибки кэширования, главное что запросы выполнены
          // Vue Query composables будут делать запросы сами при необходимости
        }

        // Логируем только при ошибках или для отладки

        // Обрабатываем ответы от обоих запросов
        let userStateData: UserStateData | null = null
        let userProfileData: UserProfile | null = null

        // 1. Обрабатываем getuserstate - извлекаем лимиты и состояние
        if (stateResponse.result === 'success' && stateResponse.data) {
          let stateArray: UserStateData[] = []

          if (Array.isArray(stateResponse.data)) {
            stateArray = stateResponse.data
          } else if (typeof stateResponse.data === 'object' && stateResponse.data !== null) {
            const dataObj = stateResponse.data as any
            if (dataObj.data && Array.isArray(dataObj.data)) {
              stateArray = dataObj.data
            } else if (dataObj.data && typeof dataObj.data === 'object') {
              stateArray = [dataObj.data as UserStateData]
            } else if (Object.keys(stateResponse.data).length > 0) {
              stateArray = [stateResponse.data as UserStateData]
            }
          }

          if (stateArray.length > 0) {
            const found = stateArray.find((item) => item && item.address === this.address)
            userStateData = found || stateArray[0]
          }
        }

        // 2. Обрабатываем getuserprofile - извлекаем полный профиль (имя, аватар и т.д.)
        if (profileResponse.result === 'success' && profileResponse.data && Array.isArray(profileResponse.data)) {
          const found = profileResponse.data.find((item) => item && item.address === this.address)
          userProfileData = found || profileResponse.data[0] || null
        }

        // 3. Объединяем данные: профиль (имя, аватар) + состояние (лимиты)
        // Приоритет: лимиты из getuserstate, профиль из getuserprofile
        // ВАЖНО: сохраняем поле 'i' (аватар) из профиля, если оно есть
        let userState: UserStateData | null = null

        if (userProfileData || userStateData) {
          // Сохраняем важные поля из профиля перед объединением
          const avatarFromProfile = userProfileData?.i

          // Собираем все поля явно, чтобы не потерять баланс
          userState = {
            // Сначала базовый профиль
            ...(userProfileData || {}),
            // Затем состояние (имеет приоритет, но может перезаписать баланс)
            ...(userStateData || {}),
            // Явно сохраняем важные поля из профиля
            ...(avatarFromProfile ? { i: avatarFromProfile } : {}),
            address: this.address, // Всегда используем текущий адрес
          } as UserStateData

          // Восстанавливаем аватар, если он потерялся
          if (!userState.i && userProfileData?.i) {
            userState.i = userProfileData.i
          }
        } else {
          // Если оба запроса не вернули данных, создаем минимальное состояние
          userState = {
            address: this.address,
          } as UserStateData
        }

        if (userState) {
          // Сохраняем как userProfile (может содержать UserStateData с лимитами)
          // Явно сохраняем поле 'i' (аватар) перед копированием
          const avatarUrl = userState.i

          // Создаем новый объект с явным указанием всех важных полей
          this.userProfile = {
            ...userState,
            i: avatarUrl, // Явно сохраняем поле 'i'
          } as UserProfile & UserStateData

          // Дополнительная проверка: если поле 'i' все еще потерялось, восстанавливаем его
          if (avatarUrl && !this.userProfile.i) {
            (this.userProfile as any).i = avatarUrl
          }

          // Сохраняем URL аватарки в отдельное поле для надежной реактивности
          if (avatarUrl) {
            this.userAvatarUrl = avatarUrl
          }

          // Дополнительная проверка: если поле 'i' все еще потерялось, восстанавливаем его
          if (avatarUrl && !this.userProfile.i) {
            (this.userProfile as any).i = avatarUrl
          }

          this.setLoading(false)
          this.isFetchingUserState = false
          return userState
        } else {
          // Если состояние не найдено, создаем минимальное состояние
          userState = {
            address: this.address,
          } as UserStateData
          this.userProfile = userState as UserProfile & UserStateData
          this.setLoading(false)
          this.isFetchingUserState = false
          return userState
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch user state'
        this.setError(errorMessage)
        this.setLoading(false)
        this.isFetchingUserState = false
        return null
      }
    },

    /**
     * Загружает профиль пользователя через getuserprofile
     *
     * ВАЖНО: Используйте fetchUserState() для получения собственных данных!
     * Этот метод предназначен для получения профилей других пользователей.
     *
     * Отличия от fetchUserState:
     * - Может работать без авторизации (для просмотра чужих профилей)
     * - Требует передачи адреса в параметрах
     * - Не включает лимиты (только базовый профиль)
     *
     * Используется для:
     * - Просмотра профилей других пользователей
     * - Получения только базовой информации (без лимитов)
     * - Отображения списков пользователей
     *
     * @deprecated Для новых компонентов используйте useUserProfile из @/composables
     *
     * @param address - Адрес пользователя (если не указан, используется текущий адрес)
     * @returns Профиль пользователя или null
     */
    async fetchUserProfile(address?: Address): Promise<UserProfile | null> {
      const targetAddress = address || this.address

      if (!targetAddress) {
        return null
      }

      this.setLoading(true)
      this.setError(null)

      try {
        // Делаем запрос напрямую (не через Vue Query, так как это action в store)
        const { getByPRCWithAuth } = await import('../../helpers/api/request')

        const { rpcEndpoints } = await import('../../helpers/api/rpc-endpoints')
        const response = await getByPRCWithAuth({
          method: rpcEndpoints.getUserProfile,
          parameters: [[targetAddress]], // getuserprofile принимает массив адресов в массиве параметров
          options: {
            auth: true, // Требуется авторизация для получения своих данных
          },
        }) as GetUserProfileResponse

        // Сохраняем в кэш Vue Query для будущих использований composables
        try {
          const { queryClient } = await import('../../query-client')
          const queryKey = ['user', 'profile', targetAddress]
          queryClient.setQueryData(queryKey, response)
        } catch (queryError) {
          // Игнорируем ошибки кэширования
        }

        // Обрабатываем ответ getuserprofile
        // getuserprofile возвращает { result: "success", data: [...] }
        let userProfile: UserProfile | null = null

        if (response && typeof response === 'object') {
          // Проверяем структуру ответа getuserprofile
          if (response.result === 'success' && response.data && Array.isArray(response.data)) {
            if (response.data.length > 0) {
              // Ищем данные для нашего адреса
              const userData = response.data.find((item) => item && item.address === targetAddress)

              if (userData) {
                userProfile = userData
              }
            } else {
              // Если массив пустой, возможно пользователь еще не зарегистрирован
              // Создаем минимальный профиль с адресом
              userProfile = {
                address: targetAddress,
              } as UserProfile
            }
          } else if (response.result === 'error') {
            throw new Error(response.error || 'Failed to fetch user profile')
          }
        }

        if (userProfile) {
          this.userProfile = userProfile
          this.setLoading(false)
          return userProfile
        } else {
          // Если профиль не найден, но ответ успешный, создаем минимальный профиль
          if (response && response.result === 'success') {
            userProfile = {
              address: targetAddress,
            } as UserProfile
            this.userProfile = userProfile
            this.setLoading(false)
            return userProfile
          }
          throw new Error(`Invalid user profile response: ${JSON.stringify(response).substring(0, 200)}`)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch user profile'
        this.setError(errorMessage)
        this.setLoading(false)
        return null
      }
    },
  },
})
