<template>
  <SC_BlockPageWork>
    <SC_BlockPagePage>
      <SC_BlockBreadcrumb>
        <RouterLink :to="{ name: 'explorer' }">{{ t('explorerPage.breadcrumbRoot') }}</RouterLink>
        <span> / {{ t('explorerPage.blockBreadcrumb') }}</span>
      </SC_BlockBreadcrumb>

      <SC_BlockTitle>
        {{ t('explorerPage.blockBreadcrumb') }}
        <SC_TabularNums>{{ heightLabel }}</SC_TabularNums>
      </SC_BlockTitle>

      <BlockNav
        :prev-hash="prevHash"
        :next-hash="nextHash"
        :has-block="!!block"
        :share-title="t('explorerPage.blockShareTitle', { height: heightLabel })"
        @go="goTo"
      />

      <BlockMetaGrid
        :block="block"
        :loading="blockLoading && !block"
        :confirmations="confirmations"
        :coinstake-info="coinstakeInfo"
        :coinstake-label="coinstakeLabel"
        :difficulty-label="difficultyLabel"
        :tx-loading="txLoading"
        :now="now"
      />

      <ExplorerError v-if="blockError" :message="blockErrorMessage" />

      <BlockTxList
        v-if="block"
        :tx-list="txList"
        :tx-loading="txLoading"
        :tx-fetching="txFetching"
        :tx-error="txError"
        :can-load-more-tx="canLoadMoreTx"
        :pager-label="pagerLabel"
        :load-more-label="loadMoreLabel"
        @load-more="loadMoreTx"
      />
    </SC_BlockPagePage>
  </SC_BlockPageWork>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import ExplorerError from '../components/shared/explorer-error.vue'
import BlockNav from './block-nav.vue'
import BlockMetaGrid from './block-meta-grid.vue'
import BlockTxList from './block-tx-list.vue'
import { useDocumentTitle } from '@/composables/use-document-title'
import { useBlockData } from './use-block-data'
import {
  SC_BlockPageWork,
  SC_BlockPagePage,
  SC_BlockBreadcrumb,
  SC_BlockTitle,
} from './block-page.styled'
import { SC_TabularNums } from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'BlockPage' })

const { t } = useI18n()

const p = defineProps<{ hashOrHeight: string }>()
const router = useRouter()

const queryInput = computed(() => p.hashOrHeight ?? '')

const {
  block,
  blockLoading,
  blockError,
  blockErrorMessage,
  txList,
  txLoading,
  txFetching,
  txError,
  canLoadMoreTx,
  loadMoreTx,
  pagerLabel,
  loadMoreLabel,
  confirmations,
  coinstakeInfo,
  coinstakeLabel,
  prevHash,
  nextHash,
  heightLabel,
  difficultyLabel,
  goTo,
  now,
} = useBlockData(queryInput, router)

useDocumentTitle(() => t('explorerPage.blockShareTitle', { height: heightLabel.value }))
</script>
