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
              <span v-else style="color: rgb(173, 181, 189)">{{ s.common.em }}</span>
              <span style="color: rgb(173, 181, 189); font-size: 12px; margin-left: 8px">
                · {{ formatRelTime(tx.nTime, now) }}
              </span>
              <div style="font-size: 11px; color: rgb(173, 181, 189); margin-top: 2px">
                {{ formatAbsTime(tx.nTime) }}
              </div>
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
              <span v-else style="color: rgb(173, 181, 189)">{{ s.tx.metaFeeUnknown }}</span>
            </SC_TxMetaValue>
          </SC_TxMetaCell>
          <SC_TxMetaCell>
            <SC_TxMetaLabel>
              {{ s.tx.metaPocketnet }}
              <InfoTooltip term-key="pocketPayload" />
            </SC_TxMetaLabel>
            <SC_TxMetaValue>
              <span v-if="pocketPayload" style="color: rgb(108, 117, 125)">
                {{ payloadKindLabel }} — {{ s.tx.metaPocketnetCardHint }}
              </span>
              <span v-else style="color: rgb(173, 181, 189)">{{ s.tx.metaPocketnetEmpty }}</span>
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
                <span v-else-if="vin.coinbase" style="color: rgb(108, 117, 125)">{{
                  s.tx.ioCoinbase
                }}</span>
                <span v-else style="color: rgb(173, 181, 189)">{{ s.common.em }}</span>
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
                <span v-else style="color: rgb(108, 117, 125)">
                  {{ s.tx.ioOpReturn }}
                </span>
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
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useTransactionDetails, useNodeInfo } from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
import HashLink from '../components/shared/hash-link.vue'
import AddressLink from '../components/shared/address-link.vue'
import InfoTooltip from '../components/shared/info-tooltip.vue'
import ShareButton from '../components/shared/share-button.vue'
import TxPayloadCard from '../components/shared/tx-payload-card.vue'
import { parsePocketnetPayload } from '../components/shared/parse-pocketnet-payload'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
  shortenHash,
} from '../components/shared/format-explorer'
import { labelForTxType } from '../components/shared/tx-type-labels'
import { calcConfirmations } from '../components/shared/extract-coinstake'
import { recordVisit } from '../components/shared/use-search-history'
import { explorerStrings as s } from '../block-explorer-strings'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { useDocumentTitle } from '@/composables/use-document-title'
import type { Transaction, TxVout } from '@/types/rpc-responses/get-transactions'
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

defineOptions({ name: 'TxPage' })

const p = defineProps<{ txid: string }>()

useDocumentTitle(() => `Транзакция ${shortenHash(p.txid)}`)

const txidRef = computed(() => p.txid ?? '')

const { data: txResp, isLoading: txLoading, error: txError } = useTransactionDetails(txidRef)

const tx = computed<Transaction | undefined>(() => txResp.value?.data?.[0])

// Регистрируем визит, когда tx реально загрузилась.
watch(
  () => tx.value?.txid,
  (id) => {
    if (id) recordVisit(p.txid, 'tx')
  }
)

// Real-time tip → confirmations растёт без рефреша страницы.
useExplorerWsUpdates()

const { data: nodeInfo } = useNodeInfo()
const tipHeight = computed(() => nodeInfo.value?.data?.lastblock?.height ?? 0)
const confirmations = computed(() => {
  const h = tx.value?.height
  if (h === undefined) return 0
  return calcConfirmations(h, tipHeight.value)
})

const typeLabel = computed(() => (tx.value ? labelForTxType(tx.value.type) : ''))

const totalIn = computed(() => {
  if (!tx.value) return 0
  return tx.value.vin.reduce((s, v) => s + (v.value ?? 0), 0)
})

const totalOut = computed(() => {
  if (!tx.value) return 0
  return tx.value.vout.reduce((s, v) => s + (v.value ?? 0), 0)
})

const feeLabel = computed(() => {
  if (!tx.value) return ''
  const anyZeroIn = tx.value.vin.some((v) => v.value === undefined)
  if (anyZeroIn) return '' // не все входы имеют value (coinbase / неизвестные)
  const fee = totalIn.value - totalOut.value
  if (fee < 0) return ''
  return formatExplorerPkoin(fee)
})

const pocketPayload = computed(() => parsePocketnetPayload(tx.value ?? null))

const payloadKindLabel = computed(() => {
  const k = pocketPayload.value?.kind
  return k ? (s.tx.payloadKindLabels[k] ?? k) : ''
})

function firstAddress(vout: TxVout): string {
  const a = vout.scriptPubKey?.addresses?.[0]
  return a && a.length > 0 ? a : ''
}

const showRaw = ref(false)
const rawJson = computed(() => (tx.value ? JSON.stringify(tx.value, null, 2) : ''))

const errorMessage = computed(() => {
  if (txError.value) {
    return s.tx.errorPrefix(extractErrorMessage(txError.value))
  }
  if (!tx.value && !txLoading.value) {
    return s.tx.notFound
  }
  return ''
})

// Live тикер
const now = ref(Math.floor(Date.now() / 1000))
let tickHandle: number | null = null
onMounted(() => {
  tickHandle = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 1000)
})
onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})
</script>
