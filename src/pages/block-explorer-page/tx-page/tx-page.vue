<template>
  <SC_TxPageWork>
    <SC_TxPagePage>
      <SC_TxBreadcrumb>
        <RouterLink :to="{ name: 'explorer' }">{{ s.common.breadcrumbRoot }}</RouterLink>
        <span> / {{ s.tx.breadcrumb }}</span>
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

      <SC_PlaceholderError v-else-if="txError || !tx">
        {{ errorMessage }}
      </SC_PlaceholderError>

      <template v-else>
        <SC_TxTitleRow>
          <SC_TxTitle>{{ s.tx.title }}</SC_TxTitle>
          <SC_TxTypeBadge>{{ typeLabel }}</SC_TxTypeBadge>
          <ShareButton :title="s.tx.shareTitle(tx.txid)" />
        </SC_TxTitleRow>

        <SC_TxMetaGrid>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaTxid }}
              <InfoTooltip term-key="txid" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue>
              <HashLink :hash="tx.txid" full :to="undefined" />
            </SC_TxMetaValue>
          </SC_TxMetaCell>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>{{ s.tx.metaType }}</SC_TxMetaLabel>
            <SC_TxMetaValue>{{ typeLabel }} ({{ tx.type }})</SC_TxMetaValue>
          </SC_TxMetaCell>

          <SC_TxMetaCell>
            <SC_TxMetaLabel>{{ s.tx.metaBlock }}</SC_TxMetaLabel>
            <SC_TxMetaValue>
              <RouterLink
                :to="{ name: 'explorer-block', params: { hashOrHeight: tx.blockHash } }"
                style="color: rgb(0, 123, 255); text-decoration: none; margin-right: 6px"
              >
                #{{ formatNumber(tx.height) }}
              </RouterLink>
              <HashLink
                :hash="tx.blockHash"
                :to="{ name: 'explorer-block', params: { hashOrHeight: tx.blockHash } }"
              />
            </SC_TxMetaValue>
          </SC_TxMetaCell>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaConfirmationsTime }}
              <InfoTooltip term-key="confirmations" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue>
              <span v-if="confirmations > 0">{{ formatNumber(confirmations) }}</span>
              <SC_Muted v-else>{{ s.common.em }}</SC_Muted>
              <SC_MutedSmInline> · {{ formatRelTime(tx.nTime, now) }} </SC_MutedSmInline>
              <SC_MutedXs>
                {{ formatAbsTime(tx.nTime) }}
              </SC_MutedXs>
            </SC_TxMetaValue>
          </SC_TxMetaCell>

          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaVin }}
              <InfoTooltip term-key="vin" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue
              >{{ tx.vin.length }} · {{ formatExplorerPkoin(totalIn) }} PKOIN</SC_TxMetaValue
            >
          </SC_TxMetaCell>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaVout }}
              <InfoTooltip term-key="vout" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue
              >{{ tx.vout.length }} · {{ formatExplorerPkoin(totalOut) }} PKOIN</SC_TxMetaValue
            >
          </SC_TxMetaCell>

          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaFee }}
              <InfoTooltip term-key="fee" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue>
              <span v-if="feeLabel">{{ feeLabel }} PKOIN</span>
              <SC_Muted v-else>{{ s.tx.metaFeeUnknown }}</SC_Muted>
            </SC_TxMetaValue>
          </SC_TxMetaCell>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaPocketnet }}
              <InfoTooltip term-key="pocketPayload" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue>
              <SC_Subtle v-if="pocketPayload">
                {{ payloadKindLabel }} — {{ s.tx.metaPocketnetCardHint }}
              </SC_Subtle>
              <SC_Muted v-else>{{ s.tx.metaPocketnetEmpty }}</SC_Muted>
            </SC_TxMetaValue>
          </SC_TxMetaCell>
        </SC_TxMetaGrid>

        <TxPayloadCard v-if="pocketPayload" :payload="pocketPayload" />

        <SC_TxIOGrid>
          <SC_TxIOColumn>
            <SC_TxIOHeader>{{ s.tx.ioHeaderVin }}</SC_TxIOHeader>
            <SC_TxIOItem v-for="(vin, i) in tx.vin" :key="`vin-${i}`">
              <SC_TxIOAddress>
                <AddressLink v-if="vin.address" :address="vin.address" />
                <SC_Subtle v-else-if="vin.coinbase">{{ s.tx.ioCoinbase }}</SC_Subtle>
                <SC_Muted v-else>{{ s.common.em }}</SC_Muted>
              </SC_TxIOAddress>
              <SC_TxIOValue v-if="vin.value !== undefined">
                {{ formatExplorerPkoin(vin.value) }} PKOIN
              </SC_TxIOValue>
              <SC_TxIOAnnotation v-if="vin.txid">
                {{ s.tx.ioVinFrom }}
                <RouterLink
                  :to="{ name: 'explorer-tx', params: { txid: vin.txid } }"
                  style="color: rgb(0, 123, 255); text-decoration: none"
                >
                  {{ shortenHash(vin.txid, 6, 6) }}:{{ vin.vout }}
                </RouterLink>
              </SC_TxIOAnnotation>
            </SC_TxIOItem>
          </SC_TxIOColumn>

          <SC_TxArrow>→</SC_TxArrow>

          <SC_TxIOColumn>
            <SC_TxIOHeader>{{ s.tx.ioHeaderVout }}</SC_TxIOHeader>
            <SC_TxIOItem v-for="(vout, i) in tx.vout" :key="`vout-${i}`">
              <SC_TxIOAddress>
                <AddressLink v-if="firstAddress(vout)" :address="firstAddress(vout)" />
                <SC_Subtle v-else>
                  {{ s.tx.ioOpReturn }}
                </SC_Subtle>
              </SC_TxIOAddress>
              <SC_TxIOValue>{{ formatExplorerPkoin(vout.value) }} PKOIN</SC_TxIOValue>
              <SC_TxIOAnnotation>#{{ vout.n }}</SC_TxIOAnnotation>
            </SC_TxIOItem>
          </SC_TxIOColumn>
        </SC_TxIOGrid>

        <SC_TxRawToggle type="button" @click="showRaw = !showRaw">
          {{ showRaw ? s.common.rawJsonHide : s.common.rawJsonShow }}
        </SC_TxRawToggle>
        <SC_TxRawPre v-if="showRaw">{{ rawJson }}</SC_TxRawPre>
      </template>
    </SC_TxPagePage>
  </SC_TxPageWork>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import HashLink from '../components/shared/hash-link.vue'
import AddressLink from '../components/shared/address-link.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import ShareButton from '../components/shared/share-button.vue'
import TxPayloadCard from '../components/shared/tx-payload-card.vue'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
  shortenHash,
} from '../components/shared/format-explorer'
import { explorerStrings as s } from '../block-explorer-strings'
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
  SC_TxIOGrid,
  SC_TxIOColumn,
  SC_TxIOHeader,
  SC_TxIOItem,
  SC_TxIOAddress,
  SC_TxIOValue,
  SC_TxIOAnnotation,
  SC_TxArrow,
  SC_TxRawToggle,
  SC_TxRawPre,
  SC_PlaceholderError,
} from './tx-page.styled'
import {
  SC_Muted,
  SC_MutedSmInline,
  SC_MutedXs,
  SC_Subtle,
} from '@/pages/block-explorer-page/components/shared/text-utility.styled'

defineOptions({ name: 'TxPage' })

const p = defineProps<{ txid: string }>()

useDocumentTitle(() => `Транзакция ${shortenHash(p.txid)}`)

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
  firstAddress,
} = useTxData(txidRef)
</script>
