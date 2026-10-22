<template>
  <ChainInfoSkeleton v-if="txLoading && !tx" />
  <ExplorerError v-else-if="txError || !tx" :message="errorMessage" />
  <div v-else>
    <TxSummaryCard
      :tx="tx"
      :confirmations="confirmations"
      :type-label="typeLabel"
      :total-in="totalIn"
      :total-out="totalOut"
      :fee-label="feeLabel"
      :pocket-payload="pocketPayload"
      :payload-kind-label="payloadKindLabel"
      :now="now"
    />

    <TxPayloadCard v-if="pocketPayload" :payload="pocketPayload" />

    <TxIoTable :tx="tx" />

    <SC_TxRawToggle type="button" @click="showRaw = !showRaw">
      {{ showRaw ? t('explorerPage.rawJsonHide') : t('explorerPage.rawJsonShow') }}
    </SC_TxRawToggle>
    <SC_TxRawPre v-if="showRaw">{{ rawJson }}</SC_TxRawPre>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import TxSummaryCard from '@/pages/block-explorer-page/tx-page/tx-summary-card.vue'
import TxIoTable from '@/pages/block-explorer-page/tx-page/tx-io-table.vue'
import TxPayloadCard from '@/pages/block-explorer-page/components/shared/tx-payload-card.vue'
import ExplorerError from '@/pages/block-explorer-page/components/shared/explorer-error.vue'
import { useTxData } from '@/pages/block-explorer-page/tx-page/use-tx-data'
import { SC_TxRawToggle, SC_TxRawPre } from '@/pages/block-explorer-page/tx-page/tx-page.styled'
import ChainInfoSkeleton from './chain-info-skeleton.vue'

defineOptions({ name: 'ChainTxView' })

const p = defineProps<{ txid: string }>()

const { t } = useI18n()

const {
  tx,
  txLoading,
  txError,
  confirmations,
  typeLabel,
  totalIn,
  totalOut,
  feeLabel,
  pocketPayload,
  payloadKindLabel,
  errorMessage,
  rawJson,
  showRaw,
  now,
} = useTxData(toRef(p, 'txid'), { rememberVisit: false })
</script>
