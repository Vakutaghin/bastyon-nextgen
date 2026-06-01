<template>
  <SC_TxSection>
    <SC_TxSectionHeader>
      <SC_TxSectionTitle>{{ t('explorerPage.blockSectionTxTitle') }}</SC_TxSectionTitle>
      <SC_TxSectionPager>{{ pagerLabel }}</SC_TxSectionPager>
    </SC_TxSectionHeader>

    <div v-if="txLoading && !txList.length">
      <SC_TxRow v-for="i in 5" :key="`tx-sk-${i}`">
        <SC_TxTypeBadge><Skeleton :width="50" :height="12" /></SC_TxTypeBadge>
        <Skeleton width="100%" :height="14" />
        <SC_TxValue><Skeleton :width="80" :height="12" /></SC_TxValue>
      </SC_TxRow>
    </div>
    <ExplorerError v-else-if="txError" :message="t('explorerPage.blockTxError')" />
    <SC_Placeholder v-else-if="!txList.length">{{ t('explorerPage.blockTxEmpty') }}</SC_Placeholder>
    <div v-else>
      <SC_TxRow v-for="tx in txList" :key="tx.txid">
        <SC_TxTypeBadge>{{ labelForTxType(tx.type) }}</SC_TxTypeBadge>
        <HashLink :hash="tx.txid" :to="{ name: 'explorer-tx', params: { txid: tx.txid } }" />
        <SC_TxValue>{{ txTotal(tx) }}</SC_TxValue>
      </SC_TxRow>
      <SC_LoadMoreFooter v-if="canLoadMoreTx">
        <SC_LoadMoreBtn type="button" :disabled="txFetching" @click="emit('load-more')">
          {{ txFetching ? t('explorerPage.loading') : loadMoreLabel }}
        </SC_LoadMoreBtn>
      </SC_LoadMoreFooter>
    </div>
  </SC_TxSection>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HashLink from '../components/shared/hash-link.vue'
import ExplorerError from '../components/shared/explorer-error.vue'
import { Skeleton } from '@/components'
import { formatExplorerPkoin } from '../components/shared/format-explorer'
import { labelForTxType } from '../components/shared/tx-type-labels'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import {
  SC_TxSection,
  SC_TxSectionHeader,
  SC_TxSectionTitle,
  SC_TxSectionPager,
  SC_TxRow,
  SC_TxTypeBadge,
  SC_TxValue,
  SC_LoadMoreFooter,
  SC_LoadMoreBtn,
  SC_Placeholder,
} from './block-page.styled'

defineOptions({ name: 'BlockTxList' })

defineProps<{
  txList: Transaction[]
  txLoading: boolean
  txFetching: boolean
  txError: unknown
  canLoadMoreTx: boolean
  pagerLabel: string
  loadMoreLabel: string
}>()

const emit = defineEmits<{ 'load-more': [] }>()

const { t } = useI18n()

function txTotal(tx: Transaction): string {
  const sum = (tx.vout ?? []).reduce((acc, v) => acc + (v.value ?? 0), 0)
  return sum > 0 ? `${formatExplorerPkoin(sum)} PKOIN` : ''
}
</script>
