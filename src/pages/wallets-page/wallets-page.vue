<template>
  <SC_WalletWork>
    <SC_WalletPage>
      <SC_WalletTitle>{{ t('wallet.title') }}</SC_WalletTitle>

      <SC_WalletTabs>
        <SC_WalletTabList>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'balances' }"
            @click="activeTabKey = 'balances'"
          >
            {{ t('wallet.tabBalances') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'transfers' }"
            @click="activeTabKey = 'transfers'"
          >
            {{ t('wallet.tabTransfers') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'history' }"
            @click="activeTabKey = 'history'"
          >
            {{ t('wallet.tabHistory') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'earnings' }"
            @click="activeTabKey = 'earnings'"
          >
            {{ t('wallet.tabEarnings') }}
          </SC_WalletTabButton>
          <SC_WalletTabButton
            type="button"
            :class="{ active: activeTabKey === 'buy' }"
            @click="activeTabKey = 'buy'"
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
            <PkoinChart />
            <SC_BuyHelp>
              <RouterLink to="/info/howtobuy">{{ t('wallet.howToBuyLink') }}</RouterLink>
            </SC_BuyHelp>
          </SC_WalletTabPanel>
        </SC_WalletTabPanels>
      </SC_WalletTabs>
    </SC_WalletPage>
  </SC_WalletWork>
</template>

<script setup lang="ts">
// Страница кошелька — только каркас вкладок и ?tab= deep-link; содержимое
// каждой вкладки живёт в саб-компоненте.
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/blockchain'
import WalletBalances from './wallet-balances/wallet-balances.vue'
// Ссылка на вкладку балансов — чтобы обновить цифры сразу после перевода (S47).
import WalletTransfer from './wallet-transfer/wallet-transfer.vue'
import WalletHistory from './wallet-history/wallet-history.vue'
import WalletEarnings from './wallet-earnings/wallet-earnings.vue'
import PkoinChart from './pkoin-chart/pkoin-chart.vue'
import {
  SC_WalletWork,
  SC_WalletPage,
  SC_WalletTitle,
  SC_WalletTabs,
  SC_WalletTabList,
  SC_WalletTabButton,
  SC_WalletTabPanels,
  SC_WalletTabPanel,
  SC_BuyHelp,
} from './wallets-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Ключи вкладок кошелька — для ?tab= deep-link (CTA со страницы лимитов).
const balancesRef = ref<{ reload: () => Promise<void> } | null>(null)

/** Перевод ушёл — пересчитываем балансы, не дожидаясь перезахода (S47). */
function reloadBalances(): void {
  void balancesRef.value?.reload()
}

const WALLET_TAB_KEYS = ['balances', 'transfers', 'history', 'earnings', 'buy']
const activeTabKey = ref<string>('balances')

onMounted(() => {
  // Открываем вкладку из query (?tab=buy) — используется CTA на странице лимитов.
  const requestedTab = route.query.tab
  if (typeof requestedTab === 'string' && WALLET_TAB_KEYS.includes(requestedTab)) {
    activeTabKey.value = requestedTab
  }
})

watch(
  () => authStore.isUserAuthenticated,
  (isAuth) => {
    if (!isAuth) router.replace('/')
  },
  { immediate: true }
)
</script>
