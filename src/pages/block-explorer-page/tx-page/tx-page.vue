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

      <SC_PlaceholderError v-else-if="txError || !tx">
        {{ errorMessage }}
      </SC_PlaceholderError>

      <template v-else>
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
              <RouterLink
                :to="{ name: 'explorer-block', params: { hashOrHeight: tx.blockHash } }"
                style="color: var(--color-primary); text-decoration: none; margin-right: 6px"
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

        <TxPayloadCard v-if="pocketPayload" :payload="pocketPayload" />

        <SC_TxIOGrid>
          <SC_TxIOColumn>
            <SC_TxIOHeader>{{ t('explorerPage.txIoHeaderVin') }}</SC_TxIOHeader>
            <SC_TxIOItem v-for="(vin, i) in tx.vin" :key="`vin-${i}`">
              <SC_TxIOAddress>
                <AddressLink v-if="vin.address" :address="vin.address" />
                <SC_Subtle v-else-if="vin.coinbase">{{ t('explorerPage.txIoCoinbase') }}</SC_Subtle>
                <SC_Muted v-else>{{ EM_DASH }}</SC_Muted>
              </SC_TxIOAddress>
              <SC_TxIOValue v-if="vin.value !== undefined">
                {{ formatExplorerPkoin(vin.value) }} PKOIN
              </SC_TxIOValue>
              <SC_TxIOAnnotation v-if="vin.txid">
                {{ t('explorerPage.txIoVinFrom') }}
                <RouterLink
                  :to="{ name: 'explorer-tx', params: { txid: vin.txid } }"
                  style="color: var(--color-primary); text-decoration: none"
                >
                  {{ shortenHash(vin.txid, 6, 6) }}:{{ vin.vout }}
                </RouterLink>
              </SC_TxIOAnnotation>
            </SC_TxIOItem>
          </SC_TxIOColumn>

          <SC_TxArrow>→</SC_TxArrow>

          <SC_TxIOColumn>
            <SC_TxIOHeader>{{ t('explorerPage.txIoHeaderVout') }}</SC_TxIOHeader>
            <SC_TxIOItem v-for="(vout, i) in tx.vout" :key="`vout-${i}`">
              <SC_TxIOAddress>
                <AddressLink v-if="firstAddress(vout)" :address="firstAddress(vout)" />
                <SC_Subtle v-else>
                  {{ t('explorerPage.txIoOpReturn') }}
                </SC_Subtle>
              </SC_TxIOAddress>
              <SC_TxIOValue>{{ formatExplorerPkoin(vout.value) }} PKOIN</SC_TxIOValue>
              <SC_TxIOAnnotation>#{{ vout.n }}</SC_TxIOAnnotation>
            </SC_TxIOItem>
          </SC_TxIOColumn>
        </SC_TxIOGrid>

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

const { t } = useI18n()

// Технический placeholder (em-dash) — не локализуется.
const EM_DASH = '—'

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
  firstAddress,
} = useTxData(txidRef)
</script>
