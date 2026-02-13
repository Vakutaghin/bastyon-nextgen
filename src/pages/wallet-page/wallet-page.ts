import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, getWalletAddressesList } from '@/blockchain'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import type { GetUserProfileResponse } from '@/types/rpc-responses/user-get'
import type { TxUnspentResponse } from '@/composables/use-user-queries'
import {
  SC_WalletWork,
  SC_WalletPage,
  SC_WalletTitle,
  SC_WalletBalanceCards,
  SC_WalletBalanceCard,
  SC_WalletBalanceLabel,
  SC_WalletBalanceValue,
  SC_WalletTableSection,
  SC_WalletTableTitle,
  SC_WalletTable,
  SC_WalletTableRow,
  SC_WalletTableHeader,
  SC_WalletTableAddress,
  SC_WalletTableBalance,
  SC_WalletLoading,
  SC_WalletError,
} from './wallet-page.styled'

export default defineComponent({
  name: 'WalletPage',
  components: {
    SC_WalletWork,
    SC_WalletPage,
    SC_WalletTitle,
    SC_WalletBalanceCards,
    SC_WalletBalanceCard,
    SC_WalletBalanceLabel,
    SC_WalletBalanceValue,
    SC_WalletTableSection,
    SC_WalletTableTitle,
    SC_WalletTable,
    SC_WalletTableRow,
    SC_WalletTableHeader,
    SC_WalletTableAddress,
    SC_WalletTableBalance,
    SC_WalletLoading,
    SC_WalletError,
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const loading = ref(true)
    const error = ref<string | null>(null)
    const accountsWithBalances = ref<{ address: string; balance: number | null }[]>([])

    const currentAddress = computed(() => authStore.getUserAddress)
    const currentProfile = computed(() => authStore.getUserProfile)

    /** Все адреса: текущий аккаунт + производные адреса кошелька (как в старом приложении: wallets2) */
    const allAddresses = computed(() => {
      const cur = currentAddress.value
      if (!cur) return []
      const walletList = getWalletAddressesList(cur)
      return [cur].concat(walletList)
    })

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

    const hasAddresses = computed(() => allAddresses.value.length > 0)

    const tableRows = computed(() => {
      const addresses = allAddresses.value
      const withBalances = accountsWithBalances.value
      if (withBalances.length > 0) {
        return withBalances
      }
      return addresses.map((addr) => ({ address: addr, balance: null as number | null }))
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
        }) as TxUnspentResponse
        if (res?.result !== 'success' || !Array.isArray(res?.data)) return 0
        return (res.data as { amount?: number }[]).reduce((s, u) => s + (u.amount ?? 0), 0)
      } catch {
        return 0
      }
    }

    async function loadBalances() {
      const addresses = allAddresses.value
      if (addresses.length === 0) {
        accountsWithBalances.value = []
        loading.value = false
        return
      }
      error.value = null
      loading.value = true
      try {
        const response = await getByPRC({
          method: rpcEndpoints.getUserProfile,
          parameters: [addresses],
          options: { auth: false },
        }) as GetUserProfileResponse

        const balanceByAddress = new Map<string, number | null>()

        if (response.result === 'success' && response.data && Array.isArray(response.data)) {
          for (const p of response.data) {
            const addr = (p as any)?.address
            const bal = (p as any)?.balance
            if (addr) balanceByAddress.set(addr, bal != null ? Number(bal) : null)
          }
        }

        const result: { address: string; balance: number | null }[] = []
        for (const addr of addresses) {
          let bal = balanceByAddress.get(addr) ?? null
          if (bal === null || bal === undefined) {
            bal = await fetchBalanceTxUnspent(addr)
          }
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

    onMounted(() => {
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

    return {
      loading,
      error,
      accountBalance,
      sumWalletsBalance,
      totalBalance,
      accountsWithBalances,
      tableRows,
      hasAddresses,
      formatBalance,
    }
  },
})
