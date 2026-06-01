<template>
  <SC_TxPageWork>
    <SC_TxPagePage>
      <SC_TxBreadcrumb>
        <RouterLink :to="{ name: 'explorer' }">{{ t('explorerPage.breadcrumbRoot') }}</RouterLink>
        <span> / {{ t('explorerPage.txBreadcrumb') }}</span>
      </SC_TxBreadcrumb>

      <template v-if="txLoading && !tx">
        <SC_TxTitleRow>
          <SC_TxTitle><Skeleton :width="180" :height="28" /></SC_TxTitle>
          <SC_TxTypeBadge><Skeleton :width="80" :height="18" /></SC_TxTypeBadge>
        </SC_TxTitleRow>
        <SC_TxMetaGrid>
          <SC_TxMetaCell v-for="i in 8" :key="`tx-meta-sk-${i}`">
            <SC_TxMetaLabel><Skeleton :width="90" :height="10" /></SC_TxMetaLabel>
            <SC_TxMetaValue><Skeleton width="80%" :height="16" /></SC_TxMetaValue>
          </SC_TxMetaCell>
        </SC_TxMetaGrid>
      </template>

      <ExplorerError v-else-if="txError || !tx" :message="errorMessage" />

      <template v-else>
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
      </template>
    </SC_TxPagePage>
  </SC_TxPageWork>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import TxPayloadCard from '../components/shared/tx-payload-card.vue'
import ExplorerError from '../components/shared/explorer-error.vue'
import TxSummaryCard from './tx-summary-card.vue'
import TxIoTable from './tx-io-table.vue'
import { Skeleton } from '@/components'
import { shortenHash } from '../components/shared/format-explorer'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useTxData } from './use-tx-data'
import {
  SC_TxPageWork,
  SC_TxPagePage,
  SC_TxBreadcrumb,
  SC_TxTitleRow,
  SC_TxTitle,
  SC_TxTypeBadge,
  SC_TxMetaGrid,
  SC_TxMetaCell,
  SC_TxMetaLabel,
  SC_TxMetaValue,
  SC_TxRawToggle,
  SC_TxRawPre,
} from './tx-page.styled'

defineOptions({ name: 'TxPage' })

const { t } = useI18n()

const p = defineProps<{ txid: string }>()

useDocumentTitle(() => t('explorerPage.txShareTitle', { txid: shortenHash(p.txid) }))

const txidRef = computed(() => p.txid ?? '')

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
} = useTxData(txidRef)
</script>
