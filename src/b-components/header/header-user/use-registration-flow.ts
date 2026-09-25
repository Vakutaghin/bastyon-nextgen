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
import { appToast } from '@/b-components/app-toast'
import { debugLog } from '@/helpers/common/debug-log'
import { t } from '@/i18n'

type AuthStore = ReturnType<typeof useAuthStore>
import { setDontShowMnemonic, shouldShowMnemonic } from '@/helpers/common/mnemonic-storage'
import { shouldShowWelcome, setWelcomeSeen } from '@/helpers/common/welcome-storage'
import {
  createRegistrationStatusWatcher,
  type RegistrationStatusWatcher,
} from './helpers/registration-status-watcher'
import { loadAccountMnemonic } from '@/b-components/header/account-switcher/helpers/load-account-mnemonic'
import { sendRegistrationUserInfoTx } from '@/blockchain/registration/user-info-tx'
import {
  clearPendingRegistration,
  loadPendingRegistration,
  type PendingRegistration,
} from '@/blockchain/storage/pending-registration'
import type { Address } from '@/blockchain/types/addresses'

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
  handleRegisterValidation: (data: { status: string; nickname?: string }) => void
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

  function handleRegisterValidation(data: { status: string; nickname?: string }): void {
    registerModalOpen.value = false

    // Сид в памяти не держим, пока идёт регистрация: по завершении его
    // поднимет showMnemonicFor из сейфа (N6).
    registrationAddress = authStore.getUserAddress

    // pending_nickname уже записан register-modal вместе с pending_registration.
    if (data.nickname) pendingNickname.value = data.nickname

    validationStatus.value = data.status
    registrationPending.value = true
    validationModalOpen.value = true

    startRegistrationStatusCheck()
    // Транзакция уходит отсюда, а не из модалки: один путь с досылом после
    // перезагрузки, и исход (отказ ноды) виден флоу (S13/S15).
    if (data.nickname) void runRegistrationTx(data.nickname, { waitForFunds: true })
  }

  function handleRegisterCancel(): void {
    registerModalOpen.value = false
  }

  function handleMnemonicModalClose(): void {
    mnemonicModalOpen.value = false
    mnemonic.value = ''
    privateKeyHex.value = ''
    // Сид показан — после перезагрузки его больше не поднимаем (S12).
    const shownFor = registrationAddress || authStore.getUserAddress
    if (shownFor) setDontShowMnemonic(shownFor)

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

  /** Снять «часики» и поллинг; pending-запись — по флагу. */
  function finishPending(opts: { clearPending: boolean }): void {
    registrationWatcher?.stop()
    registrationPending.value = false
    pendingNickname.value = null
    validationModalOpen.value = false
    if (opts.clearPending && registrationAddress) {
      const pending = loadPendingRegistration()
      if (pending?.address === registrationAddress) clearPendingRegistration()
    }
  }

  /**
   * Сид после регистрации: из памяти (та же сессия) или из хранилища аккаунта
   * (после перезагрузки — раньше в этом случае 12 слов не показывались
   * никогда, S12). Флаг «показать» ставит register-modal при создании ключей.
   */
  async function showMnemonicFor(address: Address): Promise<void> {
    if (!mnemonic.value) {
      if (!shouldShowMnemonic(address)) return
      try {
        const parsed = await loadAccountMnemonic(address)
        mnemonic.value = parsed.mnemonic
        privateKeyHex.value = parsed.privateKeyHex
      } catch {
        return
      }
    }
    mnemonicModalOpen.value = true
    pendingWelcome.value = true
  }

  async function startRegistrationStatusCheck(): Promise<void> {
    registrationWatcher?.stop()
    if (!registrationAddress) registrationAddress = authStore.getUserAddress
    const address = registrationAddress
    registrationWatcher = createRegistrationStatusWatcher({
      onStatusUpdate: (status) => {
        if (abandonIfSessionChanged()) return
        debugLog('[header-user] Status check:', status)
        validationStatus.value = status
      },
      onComplete: async (status) => {
        if (abandonIfSessionChanged()) return
        debugLog('[header-user] Registration complete:', status)
        finishPending({ clearPending: true })
        if (address) await showMnemonicFor(address as Address)
        await authStore.fetchUserState()
      },
      onError: (err) => {
        console.error('Failed to check registration status:', err)
      },
      onTimeout: () => {
        if (abandonIfSessionChanged()) return
        // pending оставляем: перезагрузка возобновит ожидание, TTL снимет сам.
        finishPending({ clearPending: false })
        appToast.warning({ message: t('accountMsg.registrationTimeout') })
      },
    })
    await registrationWatcher.start()
  }

  /**
   * Отправка/досыл userInfo-транзакции. Один путь для «сразу после модалки»
   * (ждём UTXO) и «после перезагрузки при step=2» (одна проба; UTXO ещё нет —
   * повторим на следующем тике статуса).
   */
  async function runRegistrationTx(
    nickname: string,
    opts: { waitForFunds: boolean }
  ): Promise<void> {
    const address = registrationAddress
    const result = await sendRegistrationUserInfoTx({
      address,
      keyPair: authStore.getKeyPair,
      nickname,
      waitForFunds: opts.waitForFunds,
    })
    if (!address || authStore.getUserAddress !== address) return
    if (result.outcome === 'sent') {
      // Ключи мессенджера уходят в userInfo — перелогин Matrix с ними.
      authStore.resetMessenger(true).catch(() => {})
    } else if (result.outcome === 'fatal') {
      // Отказ ноды виден пользователю, а не глотается «часиками» (S13).
      finishPending({ clearPending: false })
      appToast.error({ message: t('accountMsg.registrationRejected', { message: result.message }) })
    }
  }

  async function checkRegistrationStatusOnLoad(): Promise<void> {
    if (!isAuthenticated.value) return

    // Pending только своего адреса: чужая запись (другой аккаунт устройства)
    // не должна ни вешать часики, ни стираться отсюда (V10).
    const pending = pendingForAddress(loadPendingRegistration(), authStore.getUserAddress)
    registrationAddress = authStore.getUserAddress

    // «Регистрация в процессе» — только когда есть своя pending-запись. Аккаунт
    // без on-chain профиля и без pending — просто незарегистрирован: раньше он
    // крутил часики и поллил два RPC каждые 5 с бесконечно (S13).
    if (!pending) {
      registrationPending.value = false
      return
    }
    if (pending.error) {
      // Нода уже отвергла эту регистрацию — ждать нечего, причину покажет модалка.
      registrationPending.value = false
      return
    }
    if (pending.nickname) {
      pendingNickname.value = pending.nickname
      debugLog('[header-user] Restored pending nickname:', pending.nickname)
    }
    // Часики сразу, до async RPC-вызова.
    registrationPending.value = true

    try {
      const { getRegistrationStatus, isRegistrationInProgress } =
        await import('@/blockchain/api/registration-status')
      const status = await getRegistrationStatus()
      debugLog('[header-user] Registration status on load:', status)

      if (isRegistrationInProgress(status)) {
        validationStatus.value = status
        startRegistrationStatusCheck()

        // Транзакция ещё не отправлена (step=2) — досылаем тем же путём.
        if (pending.step >= 2 && pending.step < 3 && pending.nickname) {
          debugLog('[header-user] Resuming background transaction for:', pending.nickname)
          void runRegistrationTx(pending.nickname, { waitForFunds: false })
        }
      } else {
        // Регистрация завершилась, пока приложение было закрыто.
        debugLog('[header-user] Registration complete, clearing pending')
        finishPending({ clearPending: true })
        if (registrationAddress) await showMnemonicFor(registrationAddress as Address)
        authStore.fetchUserState().catch(() => {})
      }
    } catch (error) {
      console.error('Failed to check registration status on load:', error)
      // Сеть недоступна: pending есть — оставляем часики и продолжаем проверять.
      startRegistrationStatusCheck()
    }
  }

  /**
   * Сид ещё не показан (флаг «показать» стоит) и регистрация не в процессе —
   * например, регистрация завершилась в прошлой сессии до показа (S12).
   */
  async function checkAndShowMnemonic(): Promise<void> {
    const address = authStore.getUserAddress
    if (!address || !isAuthenticated.value || registrationPending.value) return
    if (!shouldShowMnemonic(address)) return
    registrationAddress = address
    setTimeout(() => {
      if (authStore.getUserAddress === address && !mnemonicModalOpen.value) {
        void showMnemonicFor(address as Address)
      }
    }, 3000)
  }

  onMounted(async () => {
    // fetchUserState вызывается внутри restoreSession.
    await authStore.restoreSession()

    await checkRegistrationStatusOnLoad()
    await checkAndShowMnemonic()
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
    handleRegisterValidation,
    handleRegisterCancel,
    handleMnemonicModalClose,
    handleValidationModalUpdate,
    onAvatarClick,
  }
}
