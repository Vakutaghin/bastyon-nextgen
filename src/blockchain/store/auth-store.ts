/**
 * Pinia Store для управления авторизацией через блокчейн
 *
 * Этот стор является фасадом — он делегирует управление ключами в keys-store,
 * а управление профилем в profile-store. Все существующие геттеры и экшены
 * сохранены как прокси для обратной совместимости.
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
import type { UserProfile } from '../../types/rpc-responses/user-get'
import type { UserState as UserStateData } from '../../types/rpc-responses/user-state'

import { generateKeys, recoverKeyPair, loadBip39Russian } from '../core/keys'
import {
  saveWasLogged,
  clearAllUserData,
  loadAccountsList,
  hasStoredSession,
  updateAccountName,
  ensureInitialized,
  destroyVault,
} from '../storage'
import { deriveAndSaveWalletAddresses } from '../wallet-addresses'
import { wsService } from '../ws'

import { useKeysStore } from './keys-store'
import { useProfileStore } from './profile-store'
import { restoreSessionImpl } from './auth-store/restore-session'

// Общий промис активного restoreSession(). На старте restore зовётся и из
// header-user onMounted, и из router beforeEach; без дедупа они параллельно
// дешифруют мнемонику и деривируют ключи (дорогая CPU-работа, ~секунды).
let restoreInFlight: Promise<boolean> | null = null

export const useAuthStore = defineStore('auth', {
  state: (): UserState & {
    userAvatarUrl: string | null
    accountsList: AccountsList | null
  } => ({
    isAuthenticated: false,
    // Если в localStorage уже есть следы сессии — стартуем в 'restoring',
    // чтобы UI показал скелетон вместо мерцания кнопки "Войти" до того,
    // как асинхронный restoreSession() поднимет ключи.
    authState: hasStoredSession() ? 'restoring' : 'unauthenticated',
    address: null,
    keyPair: null,
    userProfile: null,
    userAvatarUrl: null,
    isLoading: false,
    error: null,
    isFetchingUserState: false,
    accountsList: null,
  }),

  getters: {
    isUserAuthenticated(): boolean {
      return this.isAuthenticated && this.authState === 'authenticated'
    },

    /** True пока стартовый restoreSession() ещё не завершился, но в localStorage есть сохранённая сессия. */
    isAuthRestoring(): boolean {
      return this.authState === 'restoring'
    },

    /**
     * Ник, закэшированный с прошлой сессии в AccountInfo.name.
     * Используется UI как мгновенная подпись до того, как fetchUserState поднимет свежий профиль —
     * чтобы не было прыжка «адрес → ник».
     */
    getCachedAccountName(): string | null {
      if (!this.address || !this.accountsList) return null
      const acc = this.accountsList.accounts.find((a) => a.address === this.address)
      return acc?.name || null
    },

    getUserAddress(): Address | null {
      return this.address
    },

    getKeyPair(): KeyPair | null {
      return this.keyPair
    },

    isAuthLoading(): boolean {
      return this.isLoading
    },

    getAuthError(): string | null {
      return this.error
    },

    getUserProfile(): UserProfile | UserStateData | null {
      return this.userProfile
    },

    getUserAvatarUrl(): string | null {
      if (this.userAvatarUrl) return this.userAvatarUrl
      const profile = this.userProfile
      if (profile && profile.i) return profile.i
      return null
    },

    getUserState(): UserStateData | null {
      const profile = this.userProfile
      if (profile && ('score_unspent' in profile || 'post_unspent' in profile)) {
        return profile as UserStateData
      }
      return null
    },

    hasUserState(): boolean {
      const profile = this.userProfile
      return !!(profile && ('score_unspent' in profile || 'post_unspent' in profile))
    },
  },

  actions: {
    // ── Helpers ──────────────────────────────────────────────────────────

    setLoading(loading: boolean): void {
      this.isLoading = loading
    },

    setError(error: string | null): void {
      this.error = error
      if (error) this.authState = 'error'
    },

    clearError(): void {
      this.error = null
      this.authState = this.isAuthenticated ? 'authenticated' : 'unauthenticated'
    },

    resetAuthOnRegistrationError(): void {
      this.isAuthenticated = false
      this.authState = 'unauthenticated'
      this.address = null
      this.keyPair = null
    },

    /**
     * Тихий откат прерванного пользователем входа. Вызывается, когда signIn
     * отменён через AbortSignal ДО записи секрета в сейф: сбрасывает ключи и
     * статус в «не авторизован», НЕ выставляя error (отмена — не ошибка).
     * Гарантирует, что после «Отмены» пользователь не остаётся залогинен.
     */
    _cancelSignIn(): SignInResult {
      const keys = useKeysStore()
      keys.clearKeys()
      this.resetAuthOnRegistrationError()
      this.setLoading(false)
      return { success: false, cancelled: true }
    },

    /** Sync key-pair state from keys-store into auth-store (local fields kept for backward compat) */
    _syncFromKeysStore(): void {
      const keys = useKeysStore()
      this.keyPair = keys.keyPair
      this.address = keys.address
      this.accountsList = keys.accountsList
    },

    /** Sync profile state from profile-store into auth-store */
    _syncFromProfileStore(): void {
      const profile = useProfileStore()
      this.userProfile = profile.userProfile
      this.userAvatarUrl = profile.userAvatarUrl
      this.isFetchingUserState = profile.isFetchingUserState
    },

    // ── Key pair ────────────────────────────────────────────────────────

    setKeyPair(keyPair: KeyPair): void {
      const keys = useKeysStore()
      keys.setKeyPair(keyPair)
      this._syncFromKeysStore()
    },

    // ── Auth flow ───────────────────────────────────────────────────────

    async register(options: RegistrationOptions = {}): Promise<RegistrationResult> {
      const { saveAfterRegistration = false } = options
      const keys = useKeysStore()

      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      try {
        await loadBip39Russian()
        const { mnemonic, keyPair } = generateKeys()
        const { generateAddressFromKeyPair } = await import('../core/addresses')
        const addressResult = generateAddressFromKeyPair(keyPair)
        const address = addressResult.addressInfo.address

        this.setKeyPair(keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        if (this.address) deriveAndSaveWalletAddresses(mnemonic, this.address)

        if (saveAfterRegistration) {
          // P0-1: создать/поднять сейф ДО первой записи секрета (degrade-not-throw).
          await ensureInitialized()
          await keys.saveMnemonic(mnemonic)
          if (this.address) keys.addAccountForAddress(this.address, mnemonic)
          this._syncFromKeysStore()
        }

        this.invalidateAllQueries().catch(() => {})
        wsService.connect()
        this.setLoading(false)

        return { mnemonic, address, keyPair }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Registration failed'
        this.isAuthenticated = false
        this.authState = 'unauthenticated'
        this.address = null
        this.keyPair = null
        this.setError(errorMessage)
        this.setLoading(false)
        throw error
      }
    },

    async signIn(
      options: SignInOptions,
      opts: { signal?: AbortSignal } = {}
    ): Promise<SignInResult> {
      const { privateKey } = options
      const { signal } = opts
      const keys = useKeysStore()
      const profile = useProfileStore()

      // Отмена ещё до старта процесса — состояние не трогаем.
      if (signal?.aborted) return { success: false, cancelled: true }

      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      // Сбрасываем профиль предыдущего аккаунта (как в switchAccount): при
      // «Добавить аккаунт» signIn переключает адрес на новый, а профиль в сторе
      // ещё прежний — иначе новый аккаунт временно показывается с данными старого
      // (дубликат в SC_AccountSwitcher, чужой ник в хедере) до фоновой fetchUserState.
      profile.clearProfile()
      this._syncFromProfileStore()

      try {
        await loadBip39Russian()
        // Отмена во время загрузки словаря — секрет ещё не тронут, выходим чисто.
        if (signal?.aborted) return this._cancelSignIn()

        if (!privateKey || typeof privateKey !== 'string')
          throw new Error('Private key is required')
        const trimmedKey = privateKey.trim()
        if (!trimmedKey) throw new Error('Private key cannot be empty')

        const recoveryResult = recoverKeyPair(trimmedKey)
        if (!recoveryResult?.keyPair) throw new Error('Failed to recover key pair from private key')

        this.setKeyPair(recoveryResult.keyPair)
        this.isAuthenticated = true
        this.authState = 'authenticated'

        // P0-1: создать/поднять сейф ДО первой записи секрета (mnemonic/приватника).
        await ensureInitialized()
        // Последнее окно чистой отмены: секрет ещё НЕ записан в сейф.
        if (signal?.aborted) return this._cancelSignIn()

        if (recoveryResult.format === 'mnemonic') {
          await keys.saveMnemonic(trimmedKey)
          if (this.address) {
            deriveAndSaveWalletAddresses(trimmedKey, this.address)
            keys.addAccountForAddress(this.address, trimmedKey)
          }
        } else if (this.address) {
          // Вход по приватному ключу: сохраняем сам ключ (зашифрованным), чтобы
          // restoreSession() поднял сессию после перезагрузки. Без этого вход по
          // ключу не «держался» — секрет жил только в памяти keyPair.
          keys.addAccountForKey(this.address, trimmedKey)
        }
        this._syncFromKeysStore()

        saveWasLogged(true)

        // Профиль подтягиваем в фоне — модалка закрывается сразу после подъёма
        // ключей, как и в restoreSession(). Иначе кнопка "Войти" висит в loading
        // до завершения сетевого RPC, хотя вход уже зафиксирован.
        if (this.address) this.fetchUserState().catch(() => {})

        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(true).catch(() => {})
        wsService.connect()
        this.setLoading(false)

        return { success: true, address: this.address || undefined }
      } catch (error) {
        // Прерывание пользователем (AbortError и т.п.) — не ошибка входа.
        if (signal?.aborted) return this._cancelSignIn()
        const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
        this.setError(errorMessage)
        this.setLoading(false)
        this.isAuthenticated = false
        this.authState = 'error'
        return { success: false, error: errorMessage }
      }
    },

    async signOut(): Promise<void> {
      this.setLoading(true)
      try {
        wsService.close()

        this.isAuthenticated = false
        this.authState = 'unauthenticated'
        this.address = null
        this.keyPair = null
        this.userProfile = null
        this.userAvatarUrl = null
        this.error = null
        this.accountsList = null

        const keys = useKeysStore()
        keys.clearKeys()
        const profile = useProfileStore()
        profile.clearProfile()
        this.resetUserRelations()

        clearAllUserData()
        // P0-1: снести device-ключ сейфа из IndexedDB + залочить память (async).
        // clearAllUserData уже стёр LS-артефакты; здесь добиваем IDB.
        await destroyVault()

        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(false).catch(() => {})
        this.setLoading(false)
      } catch {
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

    async restoreSession(): Promise<boolean> {
      // Сессия уже поднята — не перезапускаем дорогой restore (дешифровка
      // мнемоники + деривация ключей). Именно повторный прогон из router-guard
      // вешал переходы по защищённым маршрутам (/wallets, /limits, …) на ~секунды.
      if (this.isUserAuthenticated && this.keyPair) return true

      // Дедуп конкурентных вызовов (boot onMounted + guard на deep-link).
      if (restoreInFlight) return restoreInFlight

      // Тело boot-восстановления вынесено в ./auth-store/restore-session
      // (см. LARGE_FILE_SPLIT_AUDIT.md). Дедуп остаётся здесь как владелец.
      restoreInFlight = restoreSessionImpl(this)
      try {
        return await restoreInFlight
      } finally {
        restoreInFlight = null
      }
    },

    validateAuth(): boolean {
      if (!this.isAuthenticated) return false
      if (!this.keyPair || !this.address) return false
      if (typeof this.address !== 'string' || this.address.length === 0) return false
      return true
    },

    isItMe(address: Address | null): boolean {
      if (!address || !this.address) return false
      return this.address === address
    },

    // ── Profile (delegated to profile-store) ────────────────────────────

    async fetchUserState(): Promise<UserStateData | null> {
      const profile = useProfileStore()
      this.setLoading(true)
      this.setError(null)
      try {
        const result = await profile.fetchUserState(this.address)
        this._syncFromProfileStore()
        // Persist nickname into AccountInfo so next session can show it
        // instantly instead of flashing the truncated address first.
        const freshName: string | undefined = result?.name
        if (this.address && freshName && typeof freshName === 'string') {
          updateAccountName(this.address, freshName)
          const listResult = loadAccountsList()
          if (listResult.success && listResult.data) {
            const keys = useKeysStore()
            keys.accountsList = listResult.data
            this.accountsList = listResult.data
          }
        }
        this.setLoading(false)
        return result
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch user state'
        this.setError(msg)
        this.setLoading(false)
        return null
      }
    },

    async fetchUserProfile(address?: Address): Promise<UserProfile | null> {
      const profile = useProfileStore()
      const targetAddress = address || this.address
      if (!targetAddress) return null

      this.setLoading(true)
      this.setError(null)
      try {
        const result = await profile.fetchUserProfile(targetAddress)
        this._syncFromProfileStore()
        this.setLoading(false)
        return result
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch user profile'
        this.setError(msg)
        this.setLoading(false)
        return null
      }
    },

    // ── Keys & accounts (delegated to keys-store) ───────────────────────

    async saveMnemonic(mnemonic: Mnemonic): Promise<void> {
      const keys = useKeysStore()
      await keys.saveMnemonic(mnemonic)
    },

    getAccountsList(): AccountsList {
      const keys = useKeysStore()
      const result = keys.getAccountsList()
      this.accountsList = keys.accountsList
      return result
    },

    getAccountsInfo(): Omit<AccountInfo, 'encryptedMnemonic'>[] {
      const keys = useKeysStore()
      return keys.getAccountsInfo()
    },

    async switchAccount(address: Address): Promise<SignInResult> {
      const keys = useKeysStore()
      const profile = useProfileStore()

      this.setLoading(true)
      this.setError(null)
      this.authState = 'authenticating'

      // Clear old profile
      profile.clearProfile()
      this._syncFromProfileStore()

      try {
        const recovered = await keys.recoverFromAccount(address)
        if (!recovered) throw new Error('Failed to recover key pair')

        this._syncFromKeysStore()
        this.isAuthenticated = true
        this.authState = 'authenticated'

        if (this.address) {
          profile.isFetchingUserState = false
          await this.fetchUserState()
        }

        this.invalidateAllQueries().catch(() => {})
        this.resetMessenger(true).catch(() => {})
        this.setLoading(false)

        return { success: true, address: this.address || undefined }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to switch account'
        this.setError(errorMessage)
        this.setLoading(false)
        this.isAuthenticated = false
        this.authState = 'error'
        return { success: false, error: errorMessage }
      }
    },

    async removeAccount(address: Address): Promise<boolean> {
      try {
        const keys = useKeysStore()
        const success = keys.removeAccount(address)
        this._syncFromKeysStore()

        if (!success) return false

        if (!keys.accountsList?.accounts?.length) {
          this.accountsList = null
          clearAllUserData()
        }

        if (this.address === address) {
          if (keys.accountsList?.accounts?.length) {
            const nextAccount = keys.accountsList.accounts[0]
            if (nextAccount?.address) {
              await this.switchAccount(nextAccount.address)
            } else {
              await this.signOut()
            }
          } else {
            await this.signOut()
          }
        }
        return true
      } catch {
        return false
      }
    },

    async getMessengerKeys(): Promise<{ private: string; public: string }[] | null> {
      const keys = useKeysStore()
      return keys.getMessengerKeys()
    },

    // ── Messenger ───────────────────────────────────────────────────────

    async resetMessenger(relogin: boolean = false): Promise<void> {
      try {
        const { useMessengerStore } = await import('@/b-components/messenger/store')
        const messengerStore = useMessengerStore()
        messengerStore.logout()
        if (relogin) {
          messengerStore.initMatrix().catch((e: unknown) => {
            console.error('[auth-store] Failed to re-init matrix:', e)
          })
        }
      } catch (e) {
        console.error('[auth-store] Failed to reset messenger:', e)
      }
    },

    /**
     * Сбрасывает блок-лист и подписки при разлогине. Динамический импорт —
     * чтобы не создавать цикл (user-relations-store импортирует useAuthStore).
     */
    resetUserRelations(): void {
      import('@/stores/user-relations-store')
        .then(({ useUserRelationsStore }) => useUserRelationsStore().reset())
        .catch((e: unknown) => console.error('[auth-store] Failed to reset relations:', e))
    },

    // ── Cache invalidation ──────────────────────────────────────────────

    async invalidateAllQueries(): Promise<void> {
      try {
        const { queryClient } = await import('../../query-client')
        await queryClient.invalidateQueries()
      } catch (e) {
        console.warn('[auth-store] Failed to invalidate all queries', e)
      }
    },

    async invalidateFeed(): Promise<void> {
      try {
        const { queryClient } = await import('../../query-client')
        await queryClient.invalidateQueries({ queryKey: ['feed', 'hierarchical-strip'] })
      } catch (e) {
        console.warn('[auth-store] Failed to invalidate feed queries', e)
      }
    },
  },
})
