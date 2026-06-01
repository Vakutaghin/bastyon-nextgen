<template>
  <SC_BlockMetaGrid v-if="loading">
    <SC_BlockMetaCell v-for="i in 10" :key="`meta-sk-${i}`">
      <SC_BlockMetaLabel><Skeleton :width="80" :height="10" /></SC_BlockMetaLabel>
      <SC_BlockMetaValue><Skeleton width="80%" :height="16" /></SC_BlockMetaValue>
    </SC_BlockMetaCell>
  </SC_BlockMetaGrid>

  <SC_BlockMetaGrid v-else-if="block">
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaHash') }}
        <InfoTooltip term-key="hash" />
      </SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        <HashLink :hash="block.hash" full />
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaHeight') }}
        <InfoTooltip term-key="height" />
      </SC_BlockMetaLabel>
      <SC_BlockMetaValue>#{{ formatNumber(block.height) }}</SC_BlockMetaValue>
    </SC_BlockMetaCell>

    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>{{ t('explorerPage.blockMetaTime') }}</SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        {{ formatAbsTime(block.time) }}
        <SC_MutedSm> ({{ formatRelTime(block.time, now) }}) </SC_MutedSm>
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>{{ t('explorerPage.blockMetaNTx') }}</SC_BlockMetaLabel>
      <SC_BlockMetaValue>{{ block.nTx }}</SC_BlockMetaValue>
    </SC_BlockMetaCell>

    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaConfirmations') }}
        <InfoTooltip term-key="confirmations" />
      </SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        <span v-if="confirmations > 0">
          {{ formatNumber(confirmations) }}
          <SC_BlockConfirmationsTip v-if="confirmations === 1">
            {{ t('explorerPage.blockMetaConfirmationsTip') }}
          </SC_BlockConfirmationsTip>
        </span>
        <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaDifficulty') }}
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
        <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaReward') }}
        <InfoTooltip term-key="blockReward" />
      </SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        <span v-if="coinstakeInfo">{{ formatExplorerPkoin(coinstakeInfo.reward) }} PKOIN</span>
        <Skeleton v-else-if="txLoading" :width="100" :height="14" />
        <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>

    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>
        {{ t('explorerPage.blockMetaMerkle') }}
        <InfoTooltip term-key="merkleRoot" />
      </SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        <HashLink :hash="block.merkleroot" full :copyable="true" :to="undefined" />
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
    <SC_BlockMetaCell>
      <SC_BlockMetaLabel>{{ t('explorerPage.blockMetaSiblings') }}</SC_BlockMetaLabel>
      <SC_BlockMetaValue>
        <SC_BlockSiblingRow v-if="block.prevhash">
          ←
          <HashLink
            :hash="block.prevhash"
            :to="{ name: 'explorer-block', params: { hashOrHeight: block.prevhash } }"
          />
        </SC_BlockSiblingRow>
        <div v-if="block.nexthash">
          →
          <HashLink
            :hash="block.nexthash"
            :to="{ name: 'explorer-block', params: { hashOrHeight: block.nexthash } }"
          />
        </div>
        <SC_BlockSiblingsEmpty v-if="!block.prevhash && !block.nexthash">
          {{ EM_DASH }}
        </SC_BlockSiblingsEmpty>
      </SC_BlockMetaValue>
    </SC_BlockMetaCell>
  </SC_BlockMetaGrid>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HashLink from '../components/shared/hash-link.vue'
import AddressLink from '../components/shared/address-link.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
} from '../components/shared/format-explorer'
import type { CompactBlock } from '@/types/rpc-responses/get-compact-block'
import type { CoinstakeInfo } from '../components/shared/extract-coinstake'
import {
  SC_BlockMetaGrid,
  SC_BlockMetaCell,
  SC_BlockMetaLabel,
  SC_BlockMetaValue,
  SC_BlockConfirmationsTip,
  SC_BlockSiblingRow,
  SC_BlockSiblingsEmpty,
} from './block-page.styled'
import {
  SC_Muted,
  SC_MutedSm,
} from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'BlockMetaGrid' })

defineProps<{
  block: CompactBlock | undefined
  loading: boolean
  confirmations: number
  coinstakeInfo: CoinstakeInfo | null
  coinstakeLabel: string
  difficultyLabel: string
  txLoading: boolean
  now: number
}>()

const { t } = useI18n()

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'
</script>
