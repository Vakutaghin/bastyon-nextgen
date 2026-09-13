<template>
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
</template>

<script setup lang="ts">
// Вкладка «Балансы» кошелька: саб-компонент, как и соседние вкладки
// (transfer/history/earnings). Вся логика — в use-wallet-balances; здесь
// только жизненный цикл: initBalances на mount и перезагрузка при смене
// адреса/списка кошельков. Редирект неавторизованного делает страница.
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { BlockOutlined, EditOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_SM } from '@/styles/icon-styles'
import { useAuthStore } from '@/blockchain'
import { useWalletBalances } from './use-wallet-balances'
import {
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
} from './wallet-balances.styled'

const { t } = useI18n()
const authStore = useAuthStore()

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

onMounted(() => {
  initBalances()
})

watch(
  () => [authStore.isUserAuthenticated, currentAddress.value, allAddresses.value.length],
  () => {
    if (!authStore.isUserAuthenticated) return
    loadBalances()
  }
)
</script>
