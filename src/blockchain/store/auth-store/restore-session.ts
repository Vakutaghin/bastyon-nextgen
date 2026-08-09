/**
 * Восстановление сессии при старте (boot): разлочка сейфа → чистка незавершённой
 * регистрации → подъём текущего аккаунта из accounts-list → legacy-fallback на
 * зашифрованную мнемонику.
 *
 * Вынесено из auth-store как самостоятельный, самый сложный и независимо
 * тестируемый юнит (см. LARGE_FILE_SPLIT_AUDIT.md). Работает над инстансом
 * auth-store (Options-store): экшены/состояние `this.*` стали `store.*`. Дедуп
 * конкурентных вызовов (restoreInFlight) остаётся во владении auth-store.
 */
import type { useAuthStore } from '../auth-store'
import { recoverKeyPair, loadBip39Russian } from '../../core/keys'
import {
  loadEncryptedMnemonic,
  clearAllUserData,
  loadAccountsList,
  ensureVaultUnlocked,
  finalizeMigration,
} from '../../storage'
import { deriveAndSaveWalletAddresses } from '../../wallet-addresses'
import { wsService } from '../../ws'
import { useKeysStore } from '../keys-store'

type AuthStore = ReturnType<typeof useAuthStore>

export async function restoreSessionImpl(store: AuthStore): Promise<boolean> {
  store.setLoading(true)
  store.setError(null)
  const keys = useKeysStore()

  // Любой выход без успеха должен сбросить 'restoring' → 'unauthenticated',
  // иначе UI-скелетон зависнет навсегда.
  const finishUnauthenticated = (): false => {
    if (store.authState === 'restoring') store.authState = 'unauthenticated'
    store.setLoading(false)
    return false
  }

  try {
    // P0-1: разблокировать сейф ДО любой дешифровки секретов. Оба сайта
    // restoreSession (onMounted + router-guard) дедупятся мемоизированным
    // ensureVaultUnlocked. Passwordless — молча; passphrase — модалка.
    const vault = await ensureVaultUnlocked()
    if (vault.status === 'needs-passphrase' || vault.status === 'storage-unavailable') {
      // Некому/нечем разлочить сейчас — не аутентифицируем, скелетон снимаем,
      // ничего НЕ стираем (self-heal на следующем буте).
      return finishUnauthenticated()
    }
    if (vault.status === 'needs-reset') {
      // Забытая passphrase / вытеснен device-ключ / повреждён конверт → чистим
      // локальные данные и уводим на импорт по 12 словам.
      clearAllUserData()
      return finishUnauthenticated()
    }
    if (vault.status === 'unlocked') {
      // Отложенно добиваем legacy-миграцию (fingerprint→S) и удаляем fingerprint.
      // Отложенно, т.к. crypto-js PBKDF2 блокирует поток; чтение до этого идёт
      // через heal-ветку. Не await — не морозим восстановление сессии.
      setTimeout(() => {
        try {
          finalizeMigration()
        } catch {
          /* self-heal на следующем буте */
        }
      }, 2500)
    }

    // Check for incomplete registration
    try {
      const pendingRaw = localStorage.getItem('pending_registration')
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw)
        if (pending && pending.step < 2) {
          localStorage.removeItem('pending_registration')
          localStorage.removeItem('pending_nickname')
          clearAllUserData()
          return finishUnauthenticated()
        }
      }
    } catch {
      /* ignore */
    }

    await loadBip39Russian()

    // Load accounts list
    const accountsListResult = loadAccountsList()
    if (accountsListResult.success && accountsListResult.data) {
      keys.accountsList = accountsListResult.data
      store._syncFromKeysStore()
    }

    // Try current account first
    if (keys.accountsList?.currentAccount) {
      const recovered = await keys.recoverFromAccount(keys.accountsList.currentAccount)
      if (recovered) {
        store._syncFromKeysStore()
        store.isAuthenticated = true
        store.authState = 'authenticated'

        if (store.address) {
          store.fetchUserState().catch(() => {})
        }

        wsService.connect()
        store.setLoading(false)
        return true
      }
    }

    // Fallback: legacy mnemonic
    const mnemonicResult = loadEncryptedMnemonic()
    if (!mnemonicResult.success || !mnemonicResult.data) {
      return finishUnauthenticated()
    }

    const mnemonic = mnemonicResult.data
    let recoveryResult
    try {
      recoveryResult = recoverKeyPair(mnemonic)
    } catch (error) {
      console.error('[auth-store] Failed to recover key pair:', error)
      store.setError(error instanceof Error ? error.message : 'Failed to recover key pair')
      store.setLoading(false)
      return false
    }

    if (!recoveryResult?.keyPair) {
      console.error('[auth-store] Recovery result is invalid:', recoveryResult)
      store.setError('Failed to recover key pair: invalid result')
      store.setLoading(false)
      return false
    }

    store.setKeyPair(recoveryResult.keyPair)
    store.isAuthenticated = true
    store.authState = 'authenticated'

    if (store.address) deriveAndSaveWalletAddresses(mnemonic, store.address)
    if (store.address) {
      store.fetchUserState().catch(() => {})
    }

    wsService.connect()
    store.setLoading(false)
    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to restore session'
    store.setError(errorMessage)
    store.setLoading(false)
    return false
  }
}
