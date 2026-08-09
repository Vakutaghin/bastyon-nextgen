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
            <SC_WalletLoading v-if="loading && !hasAddresses">
              {{ t('wallet.loading') }}
            </SC_WalletLoading>

            <SC_WalletError v-else-if="error">
              {{ error }}
            </SC_WalletError>

            <template v-else>
              <SC_WalletBalanceCards>
                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>{{ t('wallet.mainWalletBalance') }}</SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(accountBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>

                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>
                    {{ t('wallet.additionalWalletsBalance') }}
                  </SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(sumWalletsBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>

                <SC_WalletBalanceCard>
                  <SC_WalletBalanceLabel>{{ t('wallet.totalBalance') }}</SC_WalletBalanceLabel>
                  <SC_WalletBalanceValue>
                    {{ formatBalance(totalBalance) }}
                  </SC_WalletBalanceValue>
                </SC_WalletBalanceCard>
              </SC_WalletBalanceCards>

              <SC_WalletTableSection>
                <SC_WalletTableTitle>{{ t('wallet.mainWallet') }}</SC_WalletTableTitle>

                <SC_WalletTable>
                  <SC_WalletTableHeader>
                    <SC_WalletTableAddress>{{ t('wallet.address') }}</SC_WalletTableAddress>
                    <SC_WalletTableBalance>{{ t('wallet.balance') }}</SC_WalletTableBalance>
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
                          :title="t('wallet.openInExplorer')"
                          @click="navigate"
                        >
                          <BlockOutlined :style="ICON_SIZE_SM" />
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
                  <SC_WalletTableTitle>{{ t('wallet.additionalWallets') }}</SC_WalletTableTitle>

                  <SC_WalletAddButton type="button" :disabled="!canAddWallet" @click="onAddWallet">
                    {{ addingWallet ? t('wallet.adding') : t('wallet.addWallet') }}
                  </SC_WalletAddButton>
                </SC_WalletTableTitleRow>

                <SC_WalletTable>
                  <SC_WalletTableHeader>
                    <SC_WalletTableAddress>{{ t('wallet.address') }}</SC_WalletTableAddress>
                    <SC_WalletTableBalance>{{ t('wallet.balance') }}</SC_WalletTableBalance>
                  </SC_WalletTableHeader>

                  <SC_WalletTableRow v-for="row in additionalTableRows" :key="row.address">
                    <SC_WalletAddressCell>
                      <SC_WalletTableAddress>
                        <SC_WalletLabel v-if="row.label">{{ row.label }}</SC_WalletLabel>
                        {{ row.address }}
                      </SC_WalletTableAddress>
                      <SC_WalletRenameBtn
                        type="button"
                        :title="t('wallet.renameWallet')"
                        @click="openRename(row.address, row.label)"
                      >
                        <EditOutlined :style="ICON_SIZE_SM" />
                      </SC_WalletRenameBtn>
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
                          :title="t('wallet.openInExplorer')"
                          @click="navigate"
                        >
                          <BlockOutlined :style="ICON_SIZE_SM" />
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

    <SC_RenameOverlay v-if="renameOpen" @click.self="closeRename">
      <SC_RenameDialog>
        <SC_RenameTitle>{{ t('wallet.renameWallet') }}</SC_RenameTitle>
        <SC_RenameInput
          v-model="renameLabel"
          :placeholder="t('wallet.walletLabelPlaceholder')"
          maxlength="40"
          @keydown.enter="saveRename"
        />
        <SC_RenameActions>
          <SC_RenameBtn type="button" @click="closeRename">
            {{ t('wallet.renameCancel') }}
          </SC_RenameBtn>
          <SC_RenameBtn type="button" :primary="true" @click="saveRename">
            {{ t('wallet.renameSave') }}
          </SC_RenameBtn>
        </SC_RenameActions>
      </SC_RenameDialog>
    </SC_RenameOverlay>
  </SC_WalletWork>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { BlockOutlined, EditOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_SM } from '@/styles/icon-styles'
import { useAuthStore } from '@/blockchain'
import { useWalletBalances } from './use-wallet-balances'
import WalletTransfer from './wallet-transfer/wallet-transfer.vue'
import WalletHistory from './wallet-history/wallet-history.vue'
import WalletEarnings from './wallet-earnings/wallet-earnings.vue'
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
  SC_WalletLabel,
  SC_WalletRenameBtn,
  SC_WalletExplorerLink,
  SC_RenameOverlay,
  SC_RenameDialog,
  SC_RenameTitle,
  SC_RenameInput,
  SC_RenameActions,
  SC_RenameBtn,
  SC_WalletTableBalance,
  SC_WalletLoading,
  SC_WalletError,
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
const WALLET_TAB_KEYS = ['balances', 'transfers', 'history', 'earnings', 'buy']
const activeTabKey = ref<string>('balances')

// Вся логика вкладки «Балансы» (загрузка, суммы, добавление, rename) — в composable.
const {
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
} = useWalletBalances()

onMounted(async () => {
  // Открываем вкладку из query (?tab=buy) — используется CTA на странице лимитов.
  const requestedTab = route.query.tab
  if (typeof requestedTab === 'string' && WALLET_TAB_KEYS.includes(requestedTab)) {
    activeTabKey.value = requestedTab
  }
  await initBalances()
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

</script>
