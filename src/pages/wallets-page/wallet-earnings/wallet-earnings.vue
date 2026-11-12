<template>
  <SC_Earnings>
    <SC_EarningsTitle
      >{{ t('wallet.earningsTitle') }} <HelpLink topic="earnings"
    /></SC_EarningsTitle>

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

    <!-- Выплаты монетизации приходят переводами — они в «Получено переводами и чаевыми». -->
    <SC_MonetizationBanner :to="{ name: 'monetization' }" data-testid="earnings-monetization">
      <SC_MonetizationIcon aria-hidden="true"><DollarOutlined /></SC_MonetizationIcon>
      <SC_MonetizationBody>
        <SC_MonetizationTitle>{{ t('wallet.monetizationBannerTitle') }}</SC_MonetizationTitle>
        <SC_MonetizationText>{{ t('wallet.monetizationBannerText') }}</SC_MonetizationText>
      </SC_MonetizationBody>
      <SC_MonetizationChevron aria-hidden="true"><RightOutlined /></SC_MonetizationChevron>
    </SC_MonetizationBanner>
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
  SC_MonetizationBanner,
  SC_MonetizationBody,
  SC_MonetizationChevron,
  SC_MonetizationIcon,
  SC_MonetizationText,
  SC_MonetizationTitle,
} from './wallet-earnings.styled'
import HelpLink from '@/b-components/help/help-link.vue'
import { DollarOutlined, RightOutlined } from '@/components/icons'

const { t } = useI18n()
const { earnings, isLoading, error } = useAccountEarnings()

/** Форматирует PKOIN-число: до 8 знаков, без хвостовых нулей. */
function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  return value.toFixed(8).replace(/\.?0+$/, '')
}

// Нода (getaccountearning) считает только входящее с чужих адресов:
// lottery — выходы coinstake (награды лотереи), donation — монеты,
// приложенные к комментариям (транзакции комментариев), transfer — обычные
// переводы, в том числе чаевые. Подписи раньше говорили «донаты» и
// «совершено переводов», и чаевые искали не там.
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
