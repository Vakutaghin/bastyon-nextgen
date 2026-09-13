// Логика вкладки «Балансы»: загрузка балансов основного (getuserprofile→txunspent)
// и дополнительных (txunspent) кошельков, производные суммы/таблицы, добавление
// кошелька и переименование ярлыка. Вынесено из wallets-page.vue.
//
// walletListVersion — ручной триггер пересчёта localStorage-backed списков:
// bump'ается при добавлении кошелька и успешном rename, иначе доп-список/ярлыки
// не пересчитываются. Rename живёт здесь же (делит walletListVersion + currentAddress).
// См. LARGE_FILE_SPLIT_AUDIT.md.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useAuthStore,
  getAdditionalWalletAddressesList,
  addOneWalletAddress,
  ensureDefaultAdditionalWallet,
  getWalletLabel,
  setWalletLabel,
} from '@/blockchain'
import { appToast } from '@/b-components/app-toast'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import type { GetUserProfileResponse } from '@/types/rpc-responses/user-get'
import { parseTxUnspentResponse } from './parse-tx-unspent'

const MAX_ADDITIONAL_WALLETS = 20

export function useWalletBalances() {
  const { t } = useI18n()
  const authStore = useAuthStore()

  const loading = ref(true)
  const error = ref<string | null>(null)
  const accountsWithBalances = ref<{ address: string; balance: number | null }[]>([])
  const walletListVersion = ref(0)
  const addingWallet = ref(false)

  const currentAddress = computed(() => authStore.getUserAddress)
  const currentProfile = computed(() => authStore.getUserProfile)

  const additionalAddresses = computed<string[]>(() => {
    // Привязываемся к walletListVersion, чтобы пересчёт срабатывал при добавлении.
    void walletListVersion.value
    const cur = currentAddress.value
    return cur ? getAdditionalWalletAddressesList(cur) : []
  })

  const allAddresses = computed<string[]>(() => {
    const cur = currentAddress.value
    return cur ? [cur].concat(additionalAddresses.value) : additionalAddresses.value
  })

  const canAddWallet = computed<boolean>(
    () => !!currentAddress.value && additionalAddresses.value.length < MAX_ADDITIONAL_WALLETS
  )

  const accountBalance = computed<number | null>(() => {
    const profile = currentProfile.value
    const bal = (profile as { balance?: number | null } | null)?.balance
    if (bal != null) return Number(bal)
    const cur = currentAddress.value
    const row = accountsWithBalances.value.find((a) => a.address === cur)
    return row?.balance ?? null
  })

  const sumWalletsBalance = computed<number>(() => {
    const cur = currentAddress.value
    return accountsWithBalances.value
      .filter((a) => a.address !== cur)
      .reduce((s, a) => s + (a.balance ?? 0), 0)
  })

  const totalBalance = computed<number>(() => {
    const account = accountBalance.value ?? 0
    return account + sumWalletsBalance.value
  })

  const hasAddresses = computed<boolean>(() => !!currentAddress.value)

  const mainTableRows = computed(() => {
    const cur = currentAddress.value
    if (!cur) return []
    // Источник тот же, что и для карточки «Баланс аккаунта»: профиль или accountsWithBalances.
    return [{ address: cur, balance: accountBalance.value }]
  })

  const additionalTableRows = computed(() => {
    void walletListVersion.value // пересчёт после rename (мутирует localStorage)
    const cur = currentAddress.value
    const addrs = additionalAddresses.value
    const withBalances = accountsWithBalances.value
    const labelOf = (addr: string): string => (cur ? getWalletLabel(cur, addr) : '')
    if (withBalances.length === 0) {
      return addrs.map((addr) => ({
        address: addr,
        balance: null as number | null,
        label: labelOf(addr),
      }))
    }
    return addrs.map((addr) => {
      const row = withBalances.find((a) => a.address === addr)
      return { address: addr, balance: row?.balance ?? null, label: labelOf(addr) }
    })
  })

  function formatBalance(bal: number | null | undefined): string {
    if (bal == null) return '—'
    return formatPkoin(bal, 2, false) + ' PKOIN'
  }

  async function fetchBalanceTxUnspent(address: string): Promise<number> {
    try {
      const res = await getByPRC({
        method: rpcEndpoints.txUnspent,
        parameters: [[address], 1, 9999999],
        options: { auth: false },
      })
      return parseTxUnspentResponse(res)
    } catch {
      return 0
    }
  }

  async function loadBalances(): Promise<void> {
    const mainAddr = currentAddress.value
    const additional = additionalAddresses.value
    const addresses = mainAddr ? [mainAddr].concat(additional) : additional

    if (addresses.length === 0) {
      accountsWithBalances.value = []
      loading.value = false
      return
    }

    error.value = null
    loading.value = true
    const result: { address: string; balance: number | null }[] = []

    try {
      // Основной адрес (P): getuserprofile возвращает баланс — это надёжнее
      // и не требует обхода UTXO.
      if (mainAddr) {
        let mainBal: number | null = null
        try {
          const request = {
            method: rpcEndpoints.getUserProfile,
            parameters: [[mainAddr]] as [string[]],
          }
          const response = authStore.isUserAuthenticated
            ? await getByPRCWithAuth(request)
            : await getByPRC({ ...request, options: { auth: false } })
          const data = (response as GetUserProfileResponse)?.data
          if (Array.isArray(data) && data[0]) {
            const bal = (data[0] as { balance?: number })?.balance
            if (bal != null) mainBal = Number(bal)
          }
        } catch {
          // игнорируем — подставим через txunspent ниже.
        }
        if (mainBal === null || mainBal === undefined) {
          mainBal = await fetchBalanceTxUnspent(mainAddr)
        }
        result.push({ address: mainAddr, balance: mainBal })
      }

      // Дополнительные адреса (Z): только txunspent.
      // getuserprofile для них не отдаёт баланс — это не аккаунты.
      for (const addr of additional) {
        const bal = await fetchBalanceTxUnspent(addr)
        result.push({ address: addr, balance: bal })
      }

      accountsWithBalances.value = result
    } catch (e) {
      error.value = e instanceof Error ? e.message : t('wallet.errorLoadBalances')
      accountsWithBalances.value = addresses.map((addr) => ({
        address: addr,
        balance: null,
      }))
    } finally {
      loading.value = false
    }
  }

  async function onAddWallet(): Promise<void> {
    const cur = currentAddress.value
    if (!cur || !canAddWallet.value) return
    addingWallet.value = true
    error.value = null
    try {
      const privateKey = authStore.getKeyPair?.privateKey ?? undefined
      const result = await addOneWalletAddress(cur, privateKey)
      if (result.success) {
        walletListVersion.value += 1
        await loadBalances()
      } else {
        error.value = result.error ?? t('wallet.errorAddWallet')
      }
    } finally {
      addingWallet.value = false
    }
  }

  /** onMounted-часть: досоздать дефолтные доп-кошельки и загрузить балансы. */
  async function initBalances(): Promise<void> {
    const cur = currentAddress.value
    if (cur && getAdditionalWalletAddressesList(cur).length < 3) {
      const privateKey = authStore.getKeyPair?.privateKey ?? undefined
      await ensureDefaultAdditionalWallet(cur, privateKey)
      walletListVersion.value += 1
    }
    loadBalances()
  }

  // ── Переименование (ярлык) доп-кошелька — локально, без влияния на деривацию ──
  const renameOpen = ref(false)
  const renameAddress = ref('')
  const renameLabel = ref('')

  function openRename(address: string, currentLabel: string): void {
    renameAddress.value = address
    renameLabel.value = currentLabel || ''
    renameOpen.value = true
  }

  function closeRename(): void {
    renameOpen.value = false
    renameAddress.value = ''
    renameLabel.value = ''
  }

  function saveRename(): void {
    const cur = currentAddress.value
    if (!cur || !renameAddress.value) {
      closeRename()
      return
    }
    const res = setWalletLabel(cur, renameAddress.value, renameLabel.value)
    if (!res.success) {
      appToast.error({ message: t('wallet.renameFailed') })
      return // оставляем модалку открытой
    }
    walletListVersion.value++
    closeRename()
  }

  // Смена аккаунта при открытой модалке — закрываем, чтобы не применить ярлык
  // к чужому кошельку.
  watch(currentAddress, () => closeRename())

  return {
    loading,
    error,
    addingWallet,
    currentAddress,
    allAddresses,
    canAddWallet,
    accountBalance,
    sumWalletsBalance,
    totalBalance,
    hasAddresses,
    mainTableRows,
    additionalTableRows,
    formatBalance,
    loadBalances,
    onAddWallet,
    initBalances,
    renameOpen,
    renameLabel,
    openRename,
    closeRename,
    saveRename,
  }
}
