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

          <SC_WalletLoading v-if="loading && !hasAddresses">
            Загрузка...
          </SC_WalletLoading>

          <SC_WalletError v-else-if="error">
            {{ error }}
          </SC_WalletError>

          <template v-else>
            <SC_WalletBalanceCards>
              <SC_WalletBalanceCard>
                <SC_WalletBalanceLabel>Баланс основного кошелька</SC_WalletBalanceLabel>
                <SC_WalletBalanceValue>{{ formatBalance(accountBalance) }}</SC_WalletBalanceValue>
              </SC_WalletBalanceCard>

              <SC_WalletBalanceCard>
                <SC_WalletBalanceLabel>Суммарный баланс на адресах всех дополнительных кошельков</SC_WalletBalanceLabel>
                <SC_WalletBalanceValue>{{ formatBalance(sumWalletsBalance) }}</SC_WalletBalanceValue>
              </SC_WalletBalanceCard>

              <SC_WalletBalanceCard>
                <SC_WalletBalanceLabel>Суммарный баланс всех кошельков</SC_WalletBalanceLabel>
                <SC_WalletBalanceValue>{{ formatBalance(totalBalance) }}</SC_WalletBalanceValue>
              </SC_WalletBalanceCard>
            </SC_WalletBalanceCards>

            <SC_WalletTableSection>
              <SC_WalletTableTitle>Основной кошелёк</SC_WalletTableTitle>

              <SC_WalletTable>
                <SC_WalletTableHeader>
                  <SC_WalletTableAddress>Адрес</SC_WalletTableAddress>
                  <SC_WalletTableBalance>Баланс</SC_WalletTableBalance>
                </SC_WalletTableHeader>

                <SC_WalletTableRow
                  v-for="row in mainTableRows"
                  :key="row.address"
                >
                  <SC_WalletTableAddress>{{ row.address }}</SC_WalletTableAddress>
                  <SC_WalletTableBalance>{{ formatBalance(row.balance) }}</SC_WalletTableBalance>
                </SC_WalletTableRow>
              </SC_WalletTable>
            </SC_WalletTableSection>

            <SC_WalletTableSectionSecondary>
              <SC_WalletTableTitleRow>
                <SC_WalletTableTitle>Дополнительные кошельки</SC_WalletTableTitle>

                <SC_WalletAddButton
                  type="button"
                  :disabled="!canAddWallet"
                  @click="onAddWallet"
                >
                  {{ addingWallet ? 'Добавление...' : 'Добавить кошелёк' }}
                </SC_WalletAddButton>
              </SC_WalletTableTitleRow>

              <SC_WalletTable>
                <SC_WalletTableHeader>
                  <SC_WalletTableAddress>Адрес</SC_WalletTableAddress>
                  <SC_WalletTableBalance>Баланс</SC_WalletTableBalance>
                </SC_WalletTableHeader>

                <SC_WalletTableRow
                  v-for="row in additionalTableRows"
                  :key="row.address"
                >
                  <SC_WalletTableAddress>{{ row.address }}</SC_WalletTableAddress>
                  <SC_WalletTableBalance>{{ formatBalance(row.balance) }}</SC_WalletTableBalance>
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

<script lang="ts">
import walletsPage from './wallets-page'

export default walletsPage
</script>
