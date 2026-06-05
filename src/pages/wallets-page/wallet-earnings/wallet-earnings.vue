<template>
  <SC_Earnings>
    <SC_EarningsTitle>{{ t('wallet.earningsTitle') }}</SC_EarningsTitle>

    <SC_EarningsState v-if="isLoading">{{ t('wallet.earningsLoading') }}</SC_EarningsState>

    <SC_EarningsState v-else-if="error">
      {{ t('wallet.earningsError') }}
    </SC_EarningsState>

    <SC_EarningsCards v-else-if="earnings">
      <SC_EarningsCard v-for="card in cards" :key="card.key">
        <SC_EarningsLabel>{{ card.label }}</SC_EarningsLabel>
        <span>
          <SC_EarningsValue>{{ card.value }}</SC_EarningsValue>
          <SC_EarningsUnit>PKOIN</SC_EarningsUnit>
        </span>
      </SC_EarningsCard>
    </SC_EarningsCards>

    <SC_EarningsState v-else>{{ t('wallet.earningsEmpty') }}</SC_EarningsState>
  </SC_Earnings>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAccountEarnings } from '@/composables/use-wallet-queries'
import {
  SC_Earnings,
  SC_EarningsTitle,
  SC_EarningsCards,
  SC_EarningsCard,
  SC_EarningsLabel,
  SC_EarningsValue,
  SC_EarningsUnit,
  SC_EarningsState,
} from './wallet-earnings.styled'

const { t } = useI18n()
const { earnings, isLoading, error } = useAccountEarnings()

/** Форматирует PKOIN-число: до 8 знаков, без хвостовых нулей. */
function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  return value.toFixed(8).replace(/\.?0+$/, '')
}

const cards = computed(() => {
  const e = earnings.value
  if (!e) return []
  return [
    { key: 'lottery', label: t('wallet.earningsLottery'), value: formatAmount(e.lottery) },
    { key: 'donation', label: t('wallet.earningsDonation'), value: formatAmount(e.donation) },
    { key: 'transfer', label: t('wallet.earningsTransfer'), value: formatAmount(e.transfer) },
  ]
})
</script>
