import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  useAuthStore,
  getAdditionalWalletAddressesList,
  addOneWalletAddress,
  ensureDefaultAdditionalWallet,
} from '@/blockchain'
import { getByPRC, getByPRCWithAuth } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import type { GetUserProfileResponse } from '@/types/rpc-responses/user-get'
import WalletTransfer from './wallet-transfer/wallet-transfer.vue'
import {
  SC_WalletWork,
  SC_WalletPage,
  SC_WalletTitle,
  SC_WalletBalanceCards,
  SC_WalletBalanceCard,
  SC_WalletBalanceLabel,
  SC_WalletBalanceValue,
  SC_WalletTableSection,
  SC_WalletTableSectionSecondary,
  SC_WalletTableTitleRow,
  SC_WalletTableTitle,
  SC_WalletAddButton,
  SC_WalletTable,
  SC_WalletTableRow,
  SC_WalletTableHeader,
  SC_WalletTableAddress,
  SC_WalletTableBalance,
  SC_WalletLoading,
  SC_WalletError,
  SC_WalletTabPlaceholder,
} from './wallets-page.styled'

const MAX_ADDITIONAL_WALLETS = 20

export default defineComponent({
  name: 'WalletsPage',
  components: {
    WalletTransfer,
    SC_WalletWork,
    SC_WalletPage,
    SC_WalletTitle,
    SC_WalletBalanceCards,
    SC_WalletBalanceCard,
    SC_WalletBalanceLabel,
    SC_WalletBalanceValue,
    SC_WalletTableSection,
    SC_WalletTableSectionSecondary,
    SC_WalletTableTitleRow,
    SC_WalletTableTitle,
    SC_WalletAddButton,
    SC_WalletTable,
    SC_WalletTableRow,
    SC_WalletTableHeader,
    SC_WalletTableAddress,
    SC_WalletTableBalance,
    SC_WalletLoading,
    SC_WalletError,
    SC_WalletTabPlaceholder,
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const accountsWithBalances = ref<{ address: string; balance: number | null }[]>([])
    const walletListVersion = ref(0)
    const addingWallet = ref(false)
    const activeTabKey = ref<string>('balances')

    const currentAddress = computed(() => authStore.getUserAddress)
    const currentProfile = computed(() => authStore.getUserProfile)

    const additionalAddresses = computed(() => {
      walletListVersion.value
      const cur = currentAddress.value
      return cur ? getAdditionalWalletAddressesList(cur) : []
    })

    const allAddresses = computed(() => {
      const cur = currentAddress.value
      if (!cur) return []
      return [cur].concat(additionalAddresses.value)
    })

    const canAddWallet = computed(
      () =>
        !addingWallet.value &&
        additionalAddresses.value.length < MAX_ADDITIONAL_WALLETS
    )

    const accountBalance = computed(() => {
      const profile = currentProfile.value
      const bal = (profile as any)?.balance
      if (bal !== null && bal !== undefined) return Number(bal)
      const cur = currentAddress.value
      const row = accountsWithBalances.value.find((a) => a.address === cur)
      return row?.balance ?? null
    })

    const sumWalletsBalance = computed(() => {
      const cur = currentAddress.value
      return accountsWithBalances.value
        .filter((a) => a.address !== cur)
        .reduce((sum, a) => sum + (a.balance ?? 0), 0)
    })

    const totalBalance = computed(() => {
      const account = accountBalance.value ?? 0
      const sumWallets = sumWalletsBalance.value
      return account + sumWallets
    })

    const hasAddresses = computed(() => !!currentAddress.value)

    const mainTableRows = computed(() => {
      const cur = currentAddress.value
      if (!cur) return []
      // Используем тот же источник, что и для карточки «Баланс аккаунта»: профиль или accountsWithBalances
      const balance = accountBalance.value
      return [{ address: cur, balance }]
    })

    const additionalTableRows = computed(() => {
      const addrs = additionalAddresses.value
      const withBalances = accountsWithBalances.value
      if (withBalances.length === 0) {
        return addrs.map((addr) => ({ address: addr, balance: null as number | null }))
      }
      return addrs.map((addr) => {
        const row = withBalances.find((a) => a.address === addr)
        return { address: addr, balance: row?.balance ?? null }
      })
    })

    function formatBalance(bal: number | null | undefined): string {
      if (bal == null) return '—'
      return formatPkoin(bal, 2, false) + ' PKOIN'
    }

    function parseTxUnspentResponse(res: unknown): number {
      if (!res || typeof res !== 'object') return 0
      let list: { amount?: number }[] = []
      const r = res as Record<string, unknown>
      if (Array.isArray(r.data) && (r.result === 'success' || !('result' in r))) {
        list = r.data as { amount?: number }[]
      } else if (Array.isArray(res)) {
        list = res as { amount?: number }[]
      }
      return list.reduce((s, u) => s + (u.amount ?? 0), 0)
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

    async function loadBalances() {
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
        // Баланс основного адреса (P): getuserprofile возвращает баланс только для аккаунтов
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
            // игнорируем, подставим через txunspent
          }
          if (mainBal === null || mainBal === undefined) {
            mainBal = await fetchBalanceTxUnspent(mainAddr)
          }
          result.push({ address: mainAddr, balance: mainBal })
        }

        // Балансы кошельков (Z): только txunspent — getuserprofile для них не используется
        for (const addr of additional) {
          const bal = await fetchBalanceTxUnspent(addr)
          result.push({ address: addr, balance: bal })
        }

        accountsWithBalances.value = result
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Не удалось загрузить балансы'
        accountsWithBalances.value = addresses.map((addr) => ({ address: addr, balance: null }))
      } finally {
        loading.value = false
      }
    }

    onMounted(async () => {
      const cur = currentAddress.value
      if (cur && getAdditionalWalletAddressesList(cur).length < 3) {
        const privateKey = authStore.getKeyPair?.privateKey ?? undefined
        await ensureDefaultAdditionalWallet(cur, privateKey)
        walletListVersion.value += 1
      }
      loadBalances()
    })

    watch(
      () => [authStore.isUserAuthenticated, currentAddress, allAddresses.value.length],
      () => {
        if (!authStore.isUserAuthenticated) {
          router.replace('/')
          return
        }
        loadBalances()
      },
      { immediate: false }
    )

    watch(
      () => authStore.isUserAuthenticated,
      (isAuth) => {
        if (!isAuth) router.replace('/')
      },
      { immediate: true }
    )

    async function onAddWallet() {
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
          error.value = result.error ?? 'Не удалось добавить кошелёк'
        }
      } finally {
        addingWallet.value = false
      }
    }

    return {
      loading,
      error,
      accountBalance,
      sumWalletsBalance,
      totalBalance,
      accountsWithBalances,
      mainTableRows,
      additionalTableRows,
      hasAddresses,
      formatBalance,
      addingWallet,
      canAddWallet,
      onAddWallet,
      activeTabKey,
    }
  },
})
