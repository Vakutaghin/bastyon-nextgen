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
import { shouldShowWelcome, setWelcomeSeen } from '@/helpers/common/welcome-storage'
import {
  createRegistrationStatusWatcher,
  type RegistrationStatusWatcher,
} from './helpers/registration-status-watcher'
import { retryRegistrationBackgroundTx } from './helpers/retry-registration-tx'
import { loadPendingMnemonic } from './helpers/pending-mnemonic'
import {
  clearPendingRegistration,
  loadPendingRegistration,
  type PendingRegistration,
} from '@/blockchain/storage/pending-registration'

/**
 * Pending-регистрация, относящаяся к ТЕКУЩЕМУ аккаунту (V10): после
 * «Добавить аккаунт» чужая запись не должна вешать часики и модалки на новую
 * сессию, но и стирать её нельзя — она ещё нужна тому аккаунту.
 */
export function pendingForAddress(
  pending: PendingRegistration | null,
  address: string | null | undefined
): PendingRegistration | null {
  if (!pending || !address) return null
  return pending.address === address ? pending : null
}

export interface RegistrationFlow {
  registerModalOpen: Ref<boolean>
  mnemonicModalOpen: Ref<boolean>
  mnemonic: Ref<string>
  privateKeyHex: Ref<string>
  validationModalOpen: Ref<boolean>
  validationStatus: Ref<string | null>
  registrationPending: Ref<boolean>
  pendingNickname: Ref<string | null>
  welcomeModalOpen: Ref<boolean>
  handleWelcomeClose: () => void
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
  onAvatarClick: (event?: Event) => void
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
  const welcomeModalOpen = ref(false)
  // true между завершением регистрации и закрытием mnemonic-модалки — чтобы
  // welcome показывался только после свежей регистрации, а не при любом показе seed.
  const pendingWelcome = ref(false)

  let registrationWatcher: RegistrationStatusWatcher | null = null
  // Адрес аккаунта, чью регистрацию ждём: watcher и показ сида привязаны к
  // нему, а не к «текущему пользователю» на момент тика (V10).
  let registrationAddress: string | null = null

  function openRegisterModal(): void {
    registerModalOpen.value = true
  }

  function handleRegisterSuccess(m: string): void {
    registerModalOpen.value = false
    if (m) {
      mnemonic.value = m
      mnemonicModalOpen.value = true
      pendingWelcome.value = true
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
    registrationAddress = authStore.getUserAddress

    // pending_nickname уже записан register-modal вместе с pending_registration.
    if (data.nickname) pendingNickname.value = data.nickname

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

    // После свежей регистрации (и показа seed) — приветственный экран, один раз.
    if (pendingWelcome.value) {
      pendingWelcome.value = false
      const address = authStore.getUserAddress
      if (shouldShowWelcome(address)) {
        setWelcomeSeen(address)
        welcomeModalOpen.value = true
      }
    }
  }

  function handleWelcomeClose(): void {
    welcomeModalOpen.value = false
  }

  // Клик по аватару гасим ТОЛЬКО при незавершённой регистрации (тогда открываем
  // модалку валидации). Иначе клик должен всплыть к ant Dropdown-триггеру, чтобы
  // открылось меню профиля — без этого клик по аватару «проглатывался».
  function onAvatarClick(event?: Event): void {
    if (registrationPending.value) {
      event?.stopPropagation()
      validationModalOpen.value = true
    }
  }

  function handleValidationModalUpdate(value: boolean): void {
    validationModalOpen.value = value
    // НЕ останавливаем polling при закрытии модалки — проверка продолжается,
    // пока `registrationPending` истинен.
  }

  /**
   * Сессия сменилась (добавили/переключили аккаунт), пока шёл поллинг: статус
   * с ноды теперь про другой адрес. Останавливаем watcher, снимаем UI-pending,
   * pending_registration НЕ трогаем — он про прежний аккаунт.
   */
  function abandonIfSessionChanged(): boolean {
    if (registrationAddress && authStore.getUserAddress === registrationAddress) return false
    registrationWatcher?.stop()
    registrationPending.value = false
    pendingNickname.value = null
    validationModalOpen.value = false
    mnemonic.value = ''
    return true
  }

  async function startRegistrationStatusCheck(): Promise<void> {
    registrationWatcher?.stop()
    if (!registrationAddress) registrationAddress = authStore.getUserAddress
    registrationWatcher = createRegistrationStatusWatcher({
      onStatusUpdate: (status) => {
        if (abandonIfSessionChanged()) return
        debugLog('[header-user] Status check:', status)
        validationStatus.value = status
      },
      onComplete: async (status) => {
        if (abandonIfSessionChanged()) return
        debugLog('[header-user] Registration complete:', status)
        registrationPending.value = false
        pendingNickname.value = null
        clearPendingRegistration()
        validationModalOpen.value = false
        if (mnemonic.value) {
          mnemonicModalOpen.value = true
          pendingWelcome.value = true
        }
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

    // Pending только своего адреса: чужая запись (другой аккаунт устройства)
    // не должна ни вешать часики, ни стираться отсюда (V10).
    const pending = pendingForAddress(loadPendingRegistration(), authStore.getUserAddress)
    registrationAddress = authStore.getUserAddress
    if (pending?.nickname) {
      pendingNickname.value = pending.nickname
      debugLog('[header-user] Restored pending nickname:', pending.nickname)
    }

    // Быстрая проверка: если есть pending — сразу ставим pending
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
        if (pending && pending.step >= 2 && pending.step < 3 && pending.nickname) {
          debugLog('[header-user] Resuming background transaction for:', pending.nickname)
          retryBackgroundTransaction(pending.nickname)
        }
      } else {
        // Регистрация завершена — очищаем pending (только свой).
        debugLog('[header-user] Registration complete, clearing pending')
        registrationPending.value = false
        pendingNickname.value = null
        if (pending) clearPendingRegistration()
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
    welcomeModalOpen,
    handleWelcomeClose,
    openRegisterModal,
    handleRegisterSuccess,
    handleRegisterValidation,
    handleRegisterCancel,
    handleMnemonicModalClose,
    handleValidationModalUpdate,
    onAvatarClick,
  }
}
