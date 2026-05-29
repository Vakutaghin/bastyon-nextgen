/**
 * Флоу регистрации в header-user: mnemonic / validation modal / polling статуса /
 * pending nickname / попытка переотправить background-tx после перезагрузки.
 *
 * Состоит из:
 *   1. handleRegisterValidation — сразу после ввода ника/капчи, поднимает
 *      validation-модалку + запускает периодический polling статуса (watcher).
 *   2. checkRegistrationStatusOnLoad — при монтировании компонента; восстанавливает
 *      pending_nickname из localStorage и решает: продолжать polling, дослать tx
 *      (step=2), или отметить регистрацию завершённой.
 *   3. checkAndShowMnemonic — если у текущего аккаунта есть локальная копия mnemonic
 *      и shouldShowMnemonic() == true (первый вход / только что зарегали) —
 *      показать модалку с фразой.
 *
 * См. CODE_AUDIT.md §1.
 */
import { onMounted, ref, type Ref } from 'vue'
import type { useAuthStore } from '@/blockchain'
import { debugLog } from '@/helpers/common/debug-log'

type AuthStore = ReturnType<typeof useAuthStore>
import { shouldShowMnemonic } from '@/helpers/common/mnemonic-storage'
import {
  createRegistrationStatusWatcher,
  type RegistrationStatusWatcher,
} from './helpers/registration-status-watcher'
import { retryRegistrationBackgroundTx } from './helpers/retry-registration-tx'
import { loadPendingMnemonic } from './helpers/pending-mnemonic'

export interface RegistrationFlow {
  registerModalOpen: Ref<boolean>
  mnemonicModalOpen: Ref<boolean>
  mnemonic: Ref<string>
  privateKeyHex: Ref<string>
  validationModalOpen: Ref<boolean>
  validationStatus: Ref<string | null>
  registrationPending: Ref<boolean>
  pendingNickname: Ref<string | null>
  openRegisterModal: () => void
  handleRegisterSuccess: (mnemonic: string) => void
  handleRegisterValidation: (data: {
    status: string
    mnemonic: string | undefined
    nickname?: string
  }) => void
  handleRegisterCancel: () => void
  handleMnemonicModalClose: () => void
  handleValidationModalUpdate: (value: boolean) => void
  onAvatarClick: () => void
}

export interface RegistrationFlowOptions {
  authStore: AuthStore
  isAuthenticated: Ref<boolean>
}

export function useRegistrationFlow(opts: RegistrationFlowOptions): RegistrationFlow {
  const { authStore, isAuthenticated } = opts

  const registerModalOpen = ref(false)
  const mnemonicModalOpen = ref(false)
  const mnemonic = ref('')
  const privateKeyHex = ref('')
  const validationModalOpen = ref(false)
  const validationStatus = ref<string | null>(null)
  const registrationPending = ref(false)
  const pendingNickname = ref<string | null>(null)

  let registrationWatcher: RegistrationStatusWatcher | null = null

  function openRegisterModal(): void {
    registerModalOpen.value = true
  }

  function handleRegisterSuccess(m: string): void {
    registerModalOpen.value = false
    if (m) {
      mnemonic.value = m
      mnemonicModalOpen.value = true
    }
    // Данные пользователя загружаются автоматически в auth-store после успешной регистрации.
  }

  function handleRegisterValidation(data: {
    status: string
    mnemonic: string | undefined
    nickname?: string
  }): void {
    registerModalOpen.value = false

    if (data.mnemonic) mnemonic.value = data.mnemonic

    if (data.nickname) {
      pendingNickname.value = data.nickname
      try {
        localStorage.setItem('pending_nickname', data.nickname)
      } catch {
        /* ignore */
      }
    }

    validationStatus.value = data.status
    registrationPending.value = true
    validationModalOpen.value = true

    startRegistrationStatusCheck()
  }

  function handleRegisterCancel(): void {
    registerModalOpen.value = false
  }

  function handleMnemonicModalClose(): void {
    mnemonicModalOpen.value = false
    mnemonic.value = ''
    privateKeyHex.value = ''
  }

  function onAvatarClick(): void {
    if (registrationPending.value) validationModalOpen.value = true
  }

  function handleValidationModalUpdate(value: boolean): void {
    validationModalOpen.value = value
    // НЕ останавливаем polling при закрытии модалки — проверка продолжается,
    // пока `registrationPending` истинен.
  }

  async function startRegistrationStatusCheck(): Promise<void> {
    registrationWatcher?.stop()
    registrationWatcher = createRegistrationStatusWatcher({
      onStatusUpdate: (status) => {
        debugLog('[header-user] Status check:', status)
        validationStatus.value = status
      },
      onComplete: async (status) => {
        debugLog('[header-user] Registration complete:', status)
        registrationPending.value = false
        pendingNickname.value = null
        try {
          localStorage.removeItem('pending_nickname')
          localStorage.removeItem('pending_registration')
        } catch {
          /* ignore */
        }
        validationModalOpen.value = false
        if (mnemonic.value) mnemonicModalOpen.value = true
        await authStore.fetchUserState()
      },
      onError: (err) => {
        console.error('Failed to check registration status:', err)
      },
    })
    await registrationWatcher.start()
  }

  /**
   * Если в localStorage висит step=2 (free/balance уже отправлены, но tx ещё нет),
   * пытается дослать транзакцию в фоне. `fatal` — хелпер уже почистил localStorage,
   * нужно снять pending в UI.
   */
  async function retryBackgroundTransaction(nickname: string): Promise<void> {
    const outcome = await retryRegistrationBackgroundTx({
      address: authStore.getUserAddress,
      keyPair: authStore.getKeyPair,
      nickname,
    })
    if (outcome === 'fatal') {
      registrationPending.value = false
      pendingNickname.value = null
    }
  }

  async function checkRegistrationStatusOnLoad(): Promise<void> {
    if (!isAuthenticated.value) return

    // Восстанавливаем pending nickname из localStorage.
    try {
      const savedNickname = localStorage.getItem('pending_nickname')
      if (savedNickname) {
        pendingNickname.value = savedNickname
        debugLog('[header-user] Restored pending nickname:', savedNickname)
      }
    } catch {
      /* ignore */
    }

    // Быстрая проверка: если есть pending_nickname — сразу ставим pending
    // (до async RPC-вызова, чтобы часики появились мгновенно).
    if (pendingNickname.value) registrationPending.value = true

    try {
      const { getRegistrationStatus, isRegistrationInProgress } =
        await import('@/blockchain/api/registration-status')
      const status = await getRegistrationStatus()
      debugLog('[header-user] Registration status on load:', status)

      if (isRegistrationInProgress(status)) {
        validationStatus.value = status
        registrationPending.value = true
        startRegistrationStatusCheck()

        // Если транзакция ещё не отправлена (step=2), запускаем фоновую отправку.
        try {
          const pendingRaw = localStorage.getItem('pending_registration')
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw)
            if (pending && pending.step >= 2 && pending.step < 3 && pending.nickname) {
              debugLog('[header-user] Resuming background transaction for:', pending.nickname)
              retryBackgroundTransaction(pending.nickname)
            }
          }
        } catch {
          /* ignore */
        }
      } else {
        // Регистрация завершена — очищаем pending.
        debugLog('[header-user] Registration complete, clearing pending')
        registrationPending.value = false
        pendingNickname.value = null
        try {
          localStorage.removeItem('pending_nickname')
          localStorage.removeItem('pending_registration')
        } catch {
          /* ignore */
        }
        // Обновляем профиль, чтобы подтянуть имя.
        authStore.fetchUserState().catch(() => {})
      }
    } catch (error) {
      console.error('Failed to check registration status on load:', error)
      // При ошибке: если есть pending_nickname — оставляем pending (лучше
      // показать часики, чем потерять статус).
      if (pendingNickname.value) {
        registrationPending.value = true
        startRegistrationStatusCheck()
      }
    }
  }

  async function checkAndShowMnemonic(): Promise<void> {
    const address = authStore.getUserAddress
    if (!address || !isAuthenticated.value) return
    if (!shouldShowMnemonic(address)) return

    const result = await loadPendingMnemonic()
    if (!result) return

    mnemonic.value = result.mnemonic
    privateKeyHex.value = result.privateKeyHex
    setTimeout(() => {
      mnemonicModalOpen.value = true
    }, 3000)
  }

  onMounted(async () => {
    // fetchUserState вызывается внутри restoreSession.
    await authStore.restoreSession()

    await checkRegistrationStatusOnLoad()
    checkAndShowMnemonic()
  })

  return {
    registerModalOpen,
    mnemonicModalOpen,
    mnemonic,
    privateKeyHex,
    validationModalOpen,
    validationStatus,
    registrationPending,
    pendingNickname,
    openRegisterModal,
    handleRegisterSuccess,
    handleRegisterValidation,
    handleRegisterCancel,
    handleMnemonicModalClose,
    handleValidationModalUpdate,
    onAvatarClick,
  }
}
