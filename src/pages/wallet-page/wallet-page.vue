<template>
  <SC_WalletWork>
    <SC_WalletPage>
      <SC_WalletTitle>Кошелёк</SC_WalletTitle>

      <SC_WalletLoading v-if="loading && !hasAddresses">
        Загрузка...
      </SC_WalletLoading>

      <SC_WalletError v-else-if="error">
        {{ error }}
      </SC_WalletError>

      <template v-else>
        <SC_WalletBalanceCards>
          <SC_WalletBalanceCard>
            <SC_WalletBalanceLabel>Баланс аккаунта</SC_WalletBalanceLabel>
            <SC_WalletBalanceValue>{{ formatBalance(accountBalance) }}</SC_WalletBalanceValue>
          </SC_WalletBalanceCard>
          <SC_WalletBalanceCard>
            <SC_WalletBalanceLabel>Суммарный баланс на адресах всех кошельков</SC_WalletBalanceLabel>
            <SC_WalletBalanceValue>{{ formatBalance(sumWalletsBalance) }}</SC_WalletBalanceValue>
          </SC_WalletBalanceCard>
          <SC_WalletBalanceCard>
            <SC_WalletBalanceLabel>Итоговый суммарный баланс</SC_WalletBalanceLabel>
            <SC_WalletBalanceValue>{{ formatBalance(totalBalance) }}</SC_WalletBalanceValue>
          </SC_WalletBalanceCard>
        </SC_WalletBalanceCards>

        <SC_WalletTableSection>
          <SC_WalletTableTitle>Кошельки</SC_WalletTableTitle>
          <SC_WalletTable>
            <SC_WalletTableHeader>
              <SC_WalletTableAddress>Адрес</SC_WalletTableAddress>
              <SC_WalletTableBalance>Баланс</SC_WalletTableBalance>
            </SC_WalletTableHeader>
            <SC_WalletTableRow
              v-for="row in tableRows"
              :key="row.address"
            >
              <SC_WalletTableAddress>{{ row.address }}</SC_WalletTableAddress>
              <SC_WalletTableBalance>{{ formatBalance(row.balance) }}</SC_WalletTableBalance>
            </SC_WalletTableRow>
          </SC_WalletTable>
        </SC_WalletTableSection>
      </template>
    </SC_WalletPage>
  </SC_WalletWork>
</template>

<script lang="ts">
import walletPage from './wallet-page'

export default walletPage
</script>
