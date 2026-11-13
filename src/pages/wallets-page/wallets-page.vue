<template>
  <SC_WalletWork>
    <SC_WalletPage>
      <SC_WalletTitle>{{ t('wallet.title') }}</SC_WalletTitle>

      <SC_WalletTabs>
        <SC_WalletTabList data-wallet-tabs>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'balances' }"
            @click="selectTab('balances')"
          >
            {{ t('wallet.tabBalances') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'transfers' }"
            @click="selectTab('transfers')"
          >
            {{ t('wallet.tabTransfers') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'history' }"
            @click="selectTab('history')"
          >
            {{ t('wallet.tabHistory') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'earnings' }"
            @click="selectTab('earnings')"
          >
            {{ t('wallet.tabEarnings') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'buy' }"
            @click="selectTab('buy')"
          >
            {{ t('wallet.tabBuySell') }}
          </SC_WalletTabButton>
        </SC_WalletTabList>

        <SC_WalletTabPanels>
          <SC_WalletTabPanel :class="{ active: activeTabKey === 'balances' }">
            <WalletBalances ref="balancesRef" />
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'transfers' }">
            <WalletTransfer @sent="reloadBalances" />
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'history' }">
            <WalletHistory v-if="activeTabKey === 'history'" />
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'earnings' }">
            <WalletEarnings v-if="activeTabKey === 'earnings'" />
          </SC_WalletTabPanel>

          <SC_WalletTabPanel :class="{ active: activeTabKey === 'buy' }">
            <WalletBuy v-if="activeTabKey === 'buy'" />
          </SC_WalletTabPanel>
        </SC_WalletTabPanels>
      </SC_WalletTabs>
    </SC_WalletPage>
  </SC_WalletWork>
</template>

<script setup lang="ts">
// Страница кошелька — только каркас вкладок и ?tab= deep-link; содержимое
// каждой вкладки живёт в саб-компоненте.
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/blockchain'
import WalletBalances from './wallet-balances/wallet-balances.vue'
// Ссылка на вкладку балансов — чтобы обновить цифры сразу после перевода (S47).
import WalletTransfer from './wallet-transfer/wallet-transfer.vue'
import WalletHistory from './wallet-history/wallet-history.vue'
import WalletEarnings from './wallet-earnings/wallet-earnings.vue'
import WalletBuy from './wallet-buy/wallet-buy.vue'
import {
  SC_WalletWork,
  SC_WalletPage,
  SC_WalletTitle,
  SC_WalletTabs,
  SC_WalletTabList,
  SC_WalletTabButton,
  SC_WalletTabPanels,
  SC_WalletTabPanel,
} from './wallets-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const balancesRef = ref<{ reload: () => Promise<void> } | null>(null)

/** Перевод ушёл — пересчитываем балансы, не дожидаясь перезахода (S47). */
function reloadBalances(): void {
  void balancesRef.value?.reload()
}

// Вкладка — в адресе (?tab=buy): туда ведут страница лимитов, монетизация,
// справка и ссылки между вкладками. Следим за адресом, а не только читаем его
// при входе: ссылка на другую вкладку с открытого кошелька тоже срабатывает.
const WALLET_TAB_KEYS = ['balances', 'transfers', 'history', 'earnings', 'buy']
const activeTabKey = ref<string>('balances')

watch(
  () => route.query.tab,
  (tab) => {
    // Уход на другой раздел — не повод переключать вкладку перед закрытием.
    if (route.name !== 'wallets') return
    activeTabKey.value = typeof tab === 'string' && WALLET_TAB_KEYS.includes(tab) ? tab : 'balances'
  },
  { immediate: true }
)

// Открытая вкладка — в поле зрения ряда: на телефоне «Покупка/продажа» за краем.
watch(
  activeTabKey,
  async () => {
    await nextTick()
    document
      .querySelector('[data-wallet-tabs] .active')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  },
  { immediate: true }
)

function selectTab(key: string): void {
  activeTabKey.value = key
  if (route.query.tab === key) return
  void router.replace({ query: { ...route.query, tab: key === 'balances' ? undefined : key } })
}

watch(
  () => authStore.isUserAuthenticated,
  (isAuth) => {
    if (!isAuth) router.replace('/')
  },
  { immediate: true }
)
</script>
