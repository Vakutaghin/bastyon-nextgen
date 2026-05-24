<template>
  <SC_AddrPageWork>
    <SC_AddrPagePage>
      <SC_AddrBreadcrumb>
        <RouterLink :to='{ name: "explorer" }'>{{ s.common.breadcrumbRoot }}</RouterLink>
        <span> / {{ s.address.breadcrumb }}</span>
      </SC_AddrBreadcrumb>

      <SC_AddrTitleRow>
        <SC_AddrTitle>
          <HashLink :hash='address' full :copyable='true' :to='undefined' />
        </SC_AddrTitle>
        <SC_AddrTitleActions>
          <ShareButton v-if='address' :title='s.address.shareTitle(address)' />
          <AddressQr v-if='address' :address='address' />
        </SC_AddrTitleActions>
      </SC_AddrTitleRow>

      <SC_AddrSummary>
        <SC_AddrSummaryCard>
          <SC_AddrSummaryLabel>{{ s.address.summaryBalance }}</SC_AddrSummaryLabel>
          <SC_AddrSummaryValue>
            <Skeleton v-if='infoLoading && !info' :width='160' :height='22' />
            <template v-else>{{ balanceLabel }}</template>
          </SC_AddrSummaryValue>
        </SC_AddrSummaryCard>
        <SC_AddrSummaryCard>
          <SC_AddrSummaryLabel>{{ s.address.summaryLastChange }}</SC_AddrSummaryLabel>
          <SC_AddrSummaryValue>
            <Skeleton v-if='infoLoading && !info' :width='120' :height='22' />
            <template v-else>{{ lastChangeLabel }}</template>
          </SC_AddrSummaryValue>
        </SC_AddrSummaryCard>
        <SC_AddrSummaryCard>
          <SC_AddrSummaryLabel>{{ s.address.summaryProfileLink }}</SC_AddrSummaryLabel>
          <SC_AddrSummaryValue style='font-size: 14px; font-weight: 500;'>
            <RouterLink
              :to='{ name: "profile", params: { userName: address } }'
              style='color: rgb(0, 123, 255); text-decoration: none;'
            >
              {{ s.address.openProfile }}
            </RouterLink>
          </SC_AddrSummaryValue>
        </SC_AddrSummaryCard>
      </SC_AddrSummary>

      <SC_AddrTxSection>
        <SC_AddrTxSectionHeader>{{ s.address.sectionTx }}</SC_AddrTxSectionHeader>

        <div v-if='txLoading && !txList.length'>
          <SC_AddrTxRow v-for='i in 5' :key='`addr-tx-sk-${i}`'>
            <SC_AddrTxTypeBadge><Skeleton :width='50' :height='12' /></SC_AddrTxTypeBadge>
            <Skeleton width='100%' :height='14' />
            <SC_AddrTxBlock><Skeleton :width='60' :height='12' /></SC_AddrTxBlock>
            <SC_AddrTxAge><Skeleton :width='60' :height='12' /></SC_AddrTxAge>
          </SC_AddrTxRow>
        </div>
        <SC_PlaceholderError v-else-if='txError'>
          {{ s.address.txError }}
        </SC_PlaceholderError>
        <SC_Placeholder v-else-if='!txList.length'>{{ s.address.txEmpty }}</SC_Placeholder>
        <div v-else>
          <SC_AddrTxRow v-for='tx in txList' :key='tx.txid'>
            <SC_AddrTxTypeBadge>{{ typeLabel(tx.type) }}</SC_AddrTxTypeBadge>
            <HashLink
              :hash='tx.txid'
              :to='{ name: "explorer-tx", params: { txid: tx.txid } }'
            />
            <SC_AddrTxBlock>
              <RouterLink
                :to='{ name: "explorer-block", params: { hashOrHeight: tx.blockHash } }'
                style='color: inherit; text-decoration: none;'
              >
                #{{ formatNumber(tx.height) }}
              </RouterLink>
            </SC_AddrTxBlock>
            <SC_AddrTxAge :title='formatAbsTime(tx.nTime)'>
              {{ formatRelTime(tx.nTime, now) }}
            </SC_AddrTxAge>
          </SC_AddrTxRow>
          <SC_LoadMoreFooter v-if='hasMoreTx'>
            <SC_LoadMoreBtn
              type='button'
              :disabled='txLoading'
              @click='loadTxPage(false)'
            >
              {{ txLoading ? s.common.loading : s.common.loadMore }}
            </SC_LoadMoreBtn>
          </SC_LoadMoreFooter>
        </div>
      </SC_AddrTxSection>
    </SC_AddrPagePage>
  </SC_AddrPageWork>
</template>

<script setup lang='ts'>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAddressInfo } from '@/composables/use-block-explorer-queries'
import { getByPRC } from '@/helpers/api/request'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { GetAddressTransactionsResponse } from '@/types/rpc-responses/get-address-transactions'
import HashLink from '../components/shared/hash-link.vue'
import AddressQr from '../components/shared/address-qr.vue'
import ShareButton from '../components/shared/share-button.vue'
import { Skeleton } from '@/components'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
} from '../components/shared/format-explorer'
import { labelForTxType } from '../components/shared/tx-type-labels'
import { recordVisit } from '../components/shared/use-search-history'
import { explorerStrings as s } from '../block-explorer-strings'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import {
  SC_AddrPageWork,
  SC_AddrPagePage,
  SC_AddrBreadcrumb,
  SC_AddrTitleRow,
  SC_AddrTitle,
  SC_AddrTitleActions,
  SC_AddrSummary,
  SC_AddrSummaryCard,
  SC_AddrSummaryLabel,
  SC_AddrSummaryValue,
  SC_AddrTxSection,
  SC_AddrTxSectionHeader,
  SC_AddrTxRow,
  SC_AddrTxTypeBadge,
  SC_AddrTxAge,
  SC_AddrTxBlock,
  SC_LoadMoreFooter,
  SC_LoadMoreBtn,
  SC_Placeholder,
  SC_PlaceholderError,
} from './address-page.styled'

defineOptions({ name: 'AddressPage' })

const p = defineProps<{ address: string }>()
const addressRef = computed(() => p.address ?? '')

const {
  data: infoResp,
  isLoading: infoLoading,
} = useAddressInfo(addressRef)

// Кастомная cursor-пагинация: API getaddresstransactions(addr, fromHeight, count)
// принимает курсор-высоту. Для «загрузить ещё» используем minHeight(текущей страницы)-1.
const TX_PAGE_SIZE = 25
const txList = ref<Transaction[]>([])
const txLoading = ref(false)
const txError = ref<unknown>(null)
const hasMoreTx = ref(true)
let nextCursorHeight = -1

async function loadTxPage(reset = false) {
  if (reset) {
    txList.value = []
    nextCursorHeight = -1
    hasMoreTx.value = true
  }
  if (!hasMoreTx.value || !addressRef.value) return
  txLoading.value = true
  txError.value = null
  try {
    const resp = (await getByPRC({
      method: rpcEndpoints.getAddressTransactions,
      parameters: [addressRef.value, nextCursorHeight, TX_PAGE_SIZE],
      options: { auth: false },
    }, getExplorerRpcConfig())) as GetAddressTransactionsResponse
    const page = resp?.data ?? []
    if (page.length === 0) {
      hasMoreTx.value = false
      return
    }
    // Дедуп по txid: на границе страниц нода может вернуть одну и ту же tx.
    const seen = new Set(txList.value.map((t) => t.txid))
    const fresh = page.filter((t) => !seen.has(t.txid))
    txList.value = txList.value.concat(fresh)

    // Следующий курсор — минимальная высота на странице, минус 1.
    const minHeight = page.reduce((m, t) => Math.min(m, t.height), Number.POSITIVE_INFINITY)
    if (Number.isFinite(minHeight) && minHeight > 0) {
      nextCursorHeight = minHeight - 1
    } else {
      hasMoreTx.value = false
    }

    // Если меньше PAGE_SIZE — больше точно нет.
    if (page.length < TX_PAGE_SIZE) hasMoreTx.value = false
  } catch (e) {
    txError.value = e
  } finally {
    txLoading.value = false
  }
}

// Перезагрузка при смене адреса (включая первый монтаж).
watch(addressRef, () => loadTxPage(true), { immediate: true })

// Регистрируем визит при смене address-параметра. Локально валидный pkoin-address
// (формат P...base58) — пишем сразу, не дожидаясь сетевого ответа.
watch(
  addressRef,
  (a) => { if (a) recordVisit(a, 'address') },
  { immediate: true },
)

const info = computed(() => infoResp.value?.data)

const address = computed(() => p.address ?? '')

const balanceLabel = computed(() => {
  const b = info.value?.balance
  if (b === undefined || b === null) return s.common.em
  return `${formatExplorerPkoin(b)} PKOIN`
})

const lastChangeLabel = computed(() => {
  const lc = info.value?.lastChange
  if (lc === undefined || lc === null || lc === -1) return s.common.em
  return s.address.lastChangeAtBlock(formatNumber(lc))
})

function typeLabel(type: number): string {
  return labelForTxType(type)
}

// Live тикер
const now = ref(Math.floor(Date.now() / 1000))
let tickHandle: number | null = null
onMounted(() => {
  tickHandle = window.setInterval(() => { now.value = Math.floor(Date.now() / 1000) }, 1000)
})
onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})
</script>
