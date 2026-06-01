<template>
  <div>
    <SC_TxTitleRow>
      <SC_TxTitle>{{ t('explorerPage.txTitle') }}</SC_TxTitle>
      <SC_TxTypeBadge>{{ typeLabel }}</SC_TxTypeBadge>
      <ShareButton :title="t('explorerPage.txShareTitle', { txid: tx.txid })" />
    </SC_TxTitleRow>

    <SC_TxMetaGrid>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaTxid') }}
          <InfoTooltip term-key="txid" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue>
          <HashLink :hash="tx.txid" full :to="undefined" />
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('explorerPage.txMetaType') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>{{ typeLabel }} ({{ tx.type }})</SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>{{ t('explorerPage.txMetaBlock') }}</SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_InlineLinkBlock
            :to="{ name: 'explorer-block', params: { hashOrHeight: tx.blockHash } }"
          >
            #{{ formatNumber(tx.height) }}
          </SC_InlineLinkBlock>
          <HashLink
            :hash="tx.blockHash"
            :to="{ name: 'explorer-block', params: { hashOrHeight: tx.blockHash } }"
          />
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaConfirmationsTime') }}
          <InfoTooltip term-key="confirmations" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue>
          <span v-if="confirmations > 0">{{ formatNumber(confirmations) }}</span>
          <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
          <SC_MutedSmInline> · {{ formatRelTime(tx.nTime, now) }} </SC_MutedSmInline>
          <SC_MutedXs>
            {{ formatAbsTime(tx.nTime) }}
          </SC_MutedXs>
        </SC_TxMetaValue>
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaVin') }}
          <InfoTooltip term-key="vin" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue
          >{{ tx.vin.length }} · {{ formatExplorerPkoin(totalIn) }} PKOIN</SC_TxMetaValue
        >
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaVout') }}
          <InfoTooltip term-key="vout" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue
          >{{ tx.vout.length }} · {{ formatExplorerPkoin(totalOut) }} PKOIN</SC_TxMetaValue
        >
      </SC_TxMetaCell>

      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaFee') }}
          <InfoTooltip term-key="fee" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue>
          <span v-if="feeLabel">{{ feeLabel }} PKOIN</span>
          <SC_Muted v-else>{{ t('explorerPage.txMetaFeeUnknown') }}</SC_Muted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
      <SC_TxMetaCell>
        <SC_TxMetaLabel>
          {{ t('explorerPage.txMetaPocketnet') }}
          <InfoTooltip term-key="pocketPayload" />
        </SC_TxMetaLabel>
        <SC_TxMetaValue>
          <SC_Subtle v-if="pocketPayload">
            {{ payloadKindLabel }} — {{ t('explorerPage.txMetaPocketnetCardHint') }}
          </SC_Subtle>
          <SC_Muted v-else>{{ t('explorerPage.txMetaPocketnetEmpty') }}</SC_Muted>
        </SC_TxMetaValue>
      </SC_TxMetaCell>
    </SC_TxMetaGrid>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HashLink from '../components/shared/hash-link.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import ShareButton from '../components/shared/share-button.vue'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
} from '../components/shared/format-explorer'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import type { PocketPayload } from '../components/shared/parse-pocketnet-payload'
import {
  SC_TxTitleRow,
  SC_TxTitle,
  SC_TxTypeBadge,
  SC_TxMetaGrid,
  SC_TxMetaCell,
  SC_TxMetaLabel,
  SC_TxMetaValue,
  SC_InlineLinkBlock,
} from './tx-page.styled'
import {
  SC_Muted,
  SC_MutedSmInline,
  SC_MutedXs,
  SC_Subtle,
} from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'TxSummaryCard' })

defineProps<{
  tx: Transaction
  confirmations: number
  typeLabel: string
  totalIn: number
  totalOut: number
  feeLabel: string
  pocketPayload: PocketPayload | null
  payloadKindLabel: string
  now: number
}>()

const { t } = useI18n()

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'
</script>
