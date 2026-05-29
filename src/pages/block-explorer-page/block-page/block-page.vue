<template>
  <SC_BlockPageWork>
    <SC_BlockPagePage>
      <SC_BlockBreadcrumb>
        <RouterLink :to="{ name: 'explorer' }">{{ s.common.breadcrumbRoot }}</RouterLink>
        <span> / {{ s.block.breadcrumb }}</span>
      </SC_BlockBreadcrumb>

      <SC_BlockTitle>
        {{ s.block.breadcrumb }}
        <SC_TabularNums>{{ heightLabel }}</SC_TabularNums>
      </SC_BlockTitle>

      <SC_BlockNav>
        <SC_BlockNavBtn type="button" :disabled="!prevHash" @click="goTo(prevHash)">
          <LeftOutlined :style="ICON_SIZE_XS" /> {{ s.block.navPrev }}
        </SC_BlockNavBtn>
        <SC_BlockNavBtn type="button" :disabled="!nextHash" @click="goTo(nextHash)">
          {{ s.block.navNext }} <RightOutlined :style="ICON_SIZE_XS" />
        </SC_BlockNavBtn>
        <ShareButton v-if="block" :title="s.block.shareTitle(heightLabel)" />
      </SC_BlockNav>

      <SC_BlockMetaGrid v-if="blockLoading && !block">
        <SC_BlockMetaCell v-for="i in 10" :key="`meta-sk-${i}`">
          <SC_BlockMetaLabel><Skeleton :width="80" :height="10" /></SC_BlockMetaLabel>
          <SC_BlockMetaValue><Skeleton width="80%" :height="16" /></SC_BlockMetaValue>
        </SC_BlockMetaCell>
      </SC_BlockMetaGrid>

      <SC_PlaceholderError v-if="blockError">
        {{ blockErrorMessage }}
      </SC_PlaceholderError>

      <template v-if="block">
        <SC_BlockMetaGrid>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaHash }}
              <InfoTooltip term-key="hash" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <HashLink :hash="block.hash" full />
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaHeight }}
              <InfoTooltip term-key="height" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>#{{ formatNumber(block.height) }}</SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>{{ s.block.metaTime }}</SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              {{ formatAbsTime(block.time) }}
              <SC_MutedSm> ({{ formatRelTime(block.time, now) }}) </SC_MutedSm>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>{{ s.block.metaNTx }}</SC_BlockMetaLabel>
            <SC_BlockMetaValue>{{ block.nTx }}</SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaConfirmations }}
              <InfoTooltip term-key="confirmations" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <span v-if="confirmations > 0">
                {{ formatNumber(confirmations) }}
                <span v-if="confirmations === 1" style="font-size: 12px; color: rgb(255, 174, 0)">
                  {{ s.block.metaConfirmationsTip }}
                </span>
              </span>
              <SC_Muted v-else>{{ s.common.em }}</SC_Muted>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaDifficulty }}
              <InfoTooltip term-key="difficulty" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              {{ difficultyLabel }}
              <SC_MutedSm>· {{ block.bits }}</SC_MutedSm>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ coinstakeLabel }}
              <InfoTooltip term-key="staker" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <AddressLink v-if="coinstakeInfo" :address="coinstakeInfo.staker" />
              <Skeleton v-else-if="txLoading" :width="180" :height="14" />
              <SC_Muted v-else>{{ s.common.em }}</SC_Muted>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaReward }}
              <InfoTooltip term-key="blockReward" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <span v-if="coinstakeInfo"
                >{{ formatExplorerPkoin(coinstakeInfo.reward) }} PKOIN</span
              >
              <Skeleton v-else-if="txLoading" :width="100" :height="14" />
              <SC_Muted v-else>{{ s.common.em }}</SC_Muted>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ s.block.metaMerkle }}
              <InfoTooltip term-key="merkleRoot" />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <HashLink :hash="block.merkleroot" full :copyable="true" :to="undefined" />
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>{{ s.block.metaSiblings }}</SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <div v-if="block.prevhash" style="margin-bottom: 4px">
                ←
                <HashLink
                  :hash="block.prevhash"
                  :to="{ name: 'explorer-block', params: { hashOrHeight: block.prevhash } }"
                />
              </div>
              <div v-if="block.nexthash">
                →
                <HashLink
                  :hash="block.nexthash"
                  :to="{ name: 'explorer-block', params: { hashOrHeight: block.nexthash } }"
                />
              </div>
              <div v-if="!block.prevhash && !block.nexthash" style="color: rgb(173, 181, 189)">
                {{ s.common.em }}
              </div>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
        </SC_BlockMetaGrid>

        <SC_TxSection>
          <SC_TxSectionHeader>
            <SC_TxSectionTitle>{{ s.block.sectionTxTitle }}</SC_TxSectionTitle>
            <SC_TxSectionPager>
              {{ pagerLabel }}
            </SC_TxSectionPager>
          </SC_TxSectionHeader>

          <div v-if="txLoading && !txList.length">
            <SC_TxRow v-for="i in 5" :key="`tx-sk-${i}`">
              <SC_TxTypeBadge><Skeleton :width="50" :height="12" /></SC_TxTypeBadge>
              <Skeleton width="100%" :height="14" />
              <SC_TxValue><Skeleton :width="80" :height="12" /></SC_TxValue>
            </SC_TxRow>
          </div>
          <SC_PlaceholderError v-else-if="txError">{{ s.block.txError }}</SC_PlaceholderError>
          <SC_Placeholder v-else-if="!txList.length">{{ s.block.txEmpty }}</SC_Placeholder>
          <div v-else>
            <SC_TxRow v-for="tx in txList" :key="tx.txid">
              <SC_TxTypeBadge>{{ typeLabel(tx.type) }}</SC_TxTypeBadge>
              <HashLink :hash="tx.txid" :to="{ name: 'explorer-tx', params: { txid: tx.txid } }" />
              <SC_TxValue>
                {{ txTotalLabel(tx) }}
              </SC_TxValue>
            </SC_TxRow>
            <SC_LoadMoreFooter v-if="canLoadMoreTx">
              <SC_LoadMoreBtn type="button" :disabled="txFetching" @click="loadMoreTx">
                {{ txFetching ? s.common.loading : loadMoreLabel }}
              </SC_LoadMoreBtn>
            </SC_LoadMoreFooter>
          </div>
        </SC_TxSection>
      </template>
    </SC_BlockPagePage>
  </SC_BlockPageWork>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_XS } from '@/styles/icon-styles'
import HashLink from '../components/shared/hash-link.vue'
import AddressLink from '../components/shared/address-link.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import ShareButton from '../components/shared/share-button.vue'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
} from '../components/shared/format-explorer'
import { useDocumentTitle } from '@/composables/use-document-title'
import { explorerStrings as s } from '../block-explorer-strings'
import { useBlockData } from './use-block-data'
import {
  SC_BlockPageWork,
  SC_BlockPagePage,
  SC_BlockBreadcrumb,
  SC_BlockTitle,
  SC_BlockNav,
  SC_BlockNavBtn,
  SC_BlockMetaGrid,
  SC_BlockMetaCell,
  SC_BlockMetaLabel,
  SC_BlockMetaValue,
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
  SC_PlaceholderError,
} from './block-page.styled'
import {
  SC_Muted,
  SC_MutedSm,
  SC_TabularNums,
} from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'BlockPage' })

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
  typeLabel,
  txTotalLabel,
  now,
} = useBlockData(queryInput, router)

useDocumentTitle(() => `Блок ${heightLabel.value}`)
</script>
