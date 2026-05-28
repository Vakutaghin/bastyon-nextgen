<template>
  <SC_WalletWork>
    <SC_WalletPage>
      <SC_WalletTitle>Кошельки</SC_WalletTitle>

      <SC_WalletTabs>
        <SC_WalletTabList>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'balances' }"
            @click="activeTabKey = 'balances'"
          >
            Балансы
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'transfers' }"
            @click="activeTabKey = 'transfers'"
          >
            Переводы
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'buy' }"
            @click="activeTabKey = 'buy'"
          >
            Покупка/продажа
          </SC_WalletTabButton>
        </SC_WalletTabList>

        <SC_WalletTabPanels>
          <SC_WalletTabPanel :class="{ active: activeTabKey === 'balances' }">
            <SC_WalletLoading v-if="loading && !hasAddresses"> Загрузка... </SC_WalletLoading>

            <SC_WalletError v-else-if="error">
              {{ error }}
            </SC_WalletError>

            <template v-else>
              <SC_WalletBalanceCards>
                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>Баланс основного кошелька</SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(accountBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>

                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>
                    Суммарный баланс на адресах всех дополнительных кошельков
                  </SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(sumWalletsBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>

                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>Суммарный баланс всех кошельков</SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(totalBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>
              </SC_WalletBalanceCards>

              <SC_WalletTableSection>
                <SC_WalletTableTitle>Основной кошелёк</SC_WalletTableTitle>

                <SC_WalletTable>
                  <SC_WalletTableHeader>
                    <SC_WalletTableAddress>Адрес</SC_WalletTableAddress>
                    <SC_WalletTableBalance>Баланс</SC_WalletTableBalance>
                  </SC_WalletTableHeader>

                  <SC_WalletTableRow v-for="row in mainTableRows" :key="row.address">
                    <SC_WalletAddressCell>
                      <SC_WalletTableAddress>{{ row.address }}</SC_WalletTableAddress>
                      <RouterLink
                        v-slot="{ navigate, href }"
                        custom
                        :to="{
                          name: 'explorer-address',
                          params: { address: row.address },
                        }"
                      >
                        <SC_WalletExplorerLink
                          :href="href"
                          title="Открыть в блок-эксплорере"
                          @click="navigate"
                        >
                          <BlockOutlined :style="{ fontSize: '14px' }" />
                        </SC_WalletExplorerLink>
                      </RouterLink>
                    </SC_WalletAddressCell>
                    <SC_WalletTableBalance>
                      {{ formatBalance(row.balance) }}
                    </SC_WalletTableBalance>
                  </SC_WalletTableRow>
                </SC_WalletTable>
              </SC_WalletTableSection>

              <SC_WalletTableSectionSecondary>
                <SC_WalletTableTitleRow>
                  <SC_WalletTableTitle>Дополнительные кошельки</SC_WalletTableTitle>

                  <SC_WalletAddButton type="button" :disabled="!canAddWallet" @click="onAddWallet">
                    {{ addingWallet ? 'Добавление...' : 'Добавить кошелёк' }}
                  </SC_WalletAddButton>
                </SC_WalletTableTitleRow>

                <SC_WalletTable>
                  <SC_WalletTableHeader>
                    <SC_WalletTableAddress>Адрес</SC_WalletTableAddress>
                    <SC_WalletTableBalance>Баланс</SC_WalletTableBalance>
                  </SC_WalletTableHeader>

                  <SC_WalletTableRow v-for="row in additionalTableRows" :key="row.address">
                    <SC_WalletAddressCell>
                      <SC_WalletTableAddress>{{ row.address }}</SC_WalletTableAddress>
                      <RouterLink
                        v-slot="{ navigate, href }"
                        custom
                        :to="{
                          name: 'explorer-address',
                          params: { address: row.address },
                        }"
                      >
                        <SC_WalletExplorerLink
                          :href="href"
                          title="Открыть в блок-эксплорере"
                          @click="navigate"
                        >
                          <BlockOutlined :style="{ fontSize: '14px' }" />
                        </SC_WalletExplorerLink>
                      </RouterLink>
                    </SC_WalletAddressCell>
                    <SC_WalletTableBalance>
                      {{ formatBalance(row.balance) }}
                    </SC_WalletTableBalance>
                  </SC_WalletTableRow>
                </SC_WalletTable>
              </SC_WalletTableSectionSecondary>
            </template>
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'transfers' }">
            <WalletTransfer />
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'buy' }">
            <PkoinChart />
          </SC_WalletTabPanel>
        </SC_WalletTabPanels>
      </SC_WalletTabs>
    </SC_WalletPage>
  </SC_WalletWork>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { BlockOutlined } from '@ant-design/icons-vue'
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
import PkoinChart from './pkoin-chart/pkoin-chart.vue'
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
  SC_WalletAddressCell,
  SC_WalletExplorerLink,
  SC_WalletTableBalance,
  SC_WalletLoading,
  SC_WalletError,
  SC_WalletTabs,
  SC_WalletTabList,
  SC_WalletTabButton,
  SC_WalletTabPanels,
  SC_WalletTabPanel,
} from './wallets-page.styled'

const MAX_ADDITIONAL_WALLETS = 20

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

const additionalAddresses = computed<string[]>(() => {
  // Привязываемся к walletListVersion, чтобы пересчёт срабатывал при добавлении
  // кошелька через `addOneWalletAddress` (он мутирует localStorage напрямую).
  void walletListVersion.value
  const cur = currentAddress.value
  return cur ? getAdditionalWalletAddressesList(cur) : []
})

const allAddresses = computed<string[]>(() => {
  const cur = currentAddress.value
  if (!cur) return []
  return [cur].concat(additionalAddresses.value)
})

const canAddWallet = computed<boolean>(
  () => !addingWallet.value && additionalAddresses.value.length < MAX_ADDITIONAL_WALLETS
)

const accountBalance = computed<number | null>(() => {
  const profile = currentProfile.value
  const bal = (profile as { balance?: number | null } | null)?.balance
  if (bal !== null && bal !== undefined) return Number(bal)
  const cur = currentAddress.value
  const row = accountsWithBalances.value.find((a) => a.address === cur)
  return row?.balance ?? null
})

const sumWalletsBalance = computed<number>(() => {
  const cur = currentAddress.value
  return accountsWithBalances.value
    .filter((a) => a.address !== cur)
    .reduce((sum, a) => sum + (a.balance ?? 0), 0)
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
    error.value = e instanceof Error ? e.message : 'Не удалось загрузить балансы'
    accountsWithBalances.value = addresses.map((addr) => ({
      address: addr,
      balance: null,
    }))
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
  () => [authStore.isUserAuthenticated, currentAddress.value, allAddresses.value.length],
  () => {
    if (!authStore.isUserAuthenticated) {
      router.replace('/')
      return
    }
    loadBalances()
  }
)

watch(
  () => authStore.isUserAuthenticated,
  (isAuth) => {
    if (!isAuth) router.replace('/')
  },
  { immediate: true }
)

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
      error.value = result.error ?? 'Не удалось добавить кошелёк'
    }
  } finally {
    addingWallet.value = false
  }
}
</script>
