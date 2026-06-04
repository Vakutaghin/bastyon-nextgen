<template>
  <div>
    <SC_HistoryHint>{{ t('wallet.history.hint') }}</SC_HistoryHint>

    <div v-if="loading && !rows.length">
      <SC_HistoryEmpty>{{ t('wallet.history.loading') }}</SC_HistoryEmpty>
    </div>

    <SC_HistoryError v-else-if="error">
      {{ t('wallet.history.error') }}
    </SC_HistoryError>

    <SC_HistoryEmpty v-else-if="!rows.length">
      {{ t('wallet.history.empty') }}
    </SC_HistoryEmpty>

    <SC_History v-else>
      <RouterLink
        v-for="row in rows"
        :key="row.tx.txid"
        v-slot="{ href, navigate }"
        custom
        :to="{ name: 'explorer-tx', params: { txid: row.tx.txid } }"
      >
        <SC_HistoryRow :href="href" @click="navigate">
          <SC_DirIcon :class="row.direction">
            <ArrowDownOutlined v-if="row.direction === 'in'" />
            <ArrowUpOutlined v-else />
          </SC_DirIcon>

          <SC_HistoryMid>
            <SC_HistoryDirLabel>
              {{ row.direction === 'in' ? t('wallet.history.received') : t('wallet.history.sent') }}
            </SC_HistoryDirLabel>
            <SC_HistoryCounterparty>{{ counterpartyLabel(row) }}</SC_HistoryCounterparty>
          </SC_HistoryMid>

          <SC_HistoryAmount :class="row.direction">
            {{ row.direction === 'in' ? '+' : '−' }}{{ formatPkoin(row.amount, 4, false) }} PKOIN
          </SC_HistoryAmount>

          <SC_HistoryTime :title="formatAbsTime(row.tx.nTime)">
            {{ formatRelTime(row.tx.nTime, now) }}
          </SC_HistoryTime>
        </SC_HistoryRow>
      </RouterLink>

      <SC_LoadMoreFooter v-if="hasMore">
        <SC_LoadMoreBtn type="button" :disabled="loading" @click="loadPage(false)">
          {{ loading ? t('wallet.history.loading') : t('wallet.history.loadMore') }}
        </SC_LoadMoreBtn>
      </SC_LoadMoreFooter>
    </SC_History>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons-vue'
import { useAuthStore, getAdditionalWalletAddressesList } from '@/blockchain'
import { getByPRC } from '@/helpers/api/request'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import {
  formatRelativeTime as formatRelTime,
  formatAbsoluteTime as formatAbsTime,
  shortenHash,
} from '@/pages/block-explorer-page/components/shared/format-explorer'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import type { GetAddressTransactionsResponse } from '@/types/rpc-responses/get-address-transactions'
import { classifyWalletTx, type WalletTxDirection } from './classify-tx'
import {
  SC_History,
  SC_HistoryHint,
  SC_HistoryRow,
  SC_DirIcon,
  SC_HistoryMid,
  SC_HistoryDirLabel,
  SC_HistoryCounterparty,
  SC_HistoryAmount,
  SC_HistoryTime,
  SC_HistoryEmpty,
  SC_HistoryError,
  SC_LoadMoreFooter,
  SC_LoadMoreBtn,
} from './wallet-history.styled'

interface HistoryRow {
  tx: Transaction
  direction: WalletTxDirection
  amount: number
  counterparties: string[]
}

const TX_PAGE_SIZE = 30

const { t } = useI18n()
const authStore = useAuthStore()

const rows = ref<HistoryRow[]>([])
const loading = ref(false)
const error = ref(false)
const hasMore = ref(true)
let nextCursorHeight = -1

const mainAddress = computed<string>(() => authStore.getUserAddress ?? '')

/** Множество всех моих адресов (основной + дополнительные) для определения «своих». */
const mine = computed<ReadonlySet<string>>(() => {
  const cur = mainAddress.value
  if (!cur) return new Set<string>()
  return new Set([cur, ...getAdditionalWalletAddressesList(cur)])
})

function counterpartyLabel(row: HistoryRow): string {
  const first = row.counterparties[0]
  if (!first)
    return row.direction === 'in' ? t('wallet.history.received') : t('wallet.history.sent')
  const short = shortenHash(first, 8, 6)
  const extra = row.counterparties.length - 1
  const base =
    row.direction === 'in'
      ? t('wallet.history.from', { addr: short })
      : t('wallet.history.to', { addr: short })
  return extra > 0 ? `${base} +${extra}` : base
}

async function loadPage(reset = false): Promise<void> {
  if (reset) {
    rows.value = []
    nextCursorHeight = -1
    hasMore.value = true
    error.value = false
  }
  const addr = mainAddress.value
  if (!addr || !hasMore.value || loading.value) return
  loading.value = true
  error.value = false
  try {
    const resp = (await getByPRC(
      {
        method: rpcEndpoints.getAddressTransactions,
        parameters: [addr, nextCursorHeight, TX_PAGE_SIZE],
        options: { auth: false },
      },
      getExplorerRpcConfig()
    )) as GetAddressTransactionsResponse
    const page = resp?.data ?? []
    if (page.length === 0) {
      hasMore.value = false
      return
    }

    const seen = new Set(rows.value.map((r) => r.tx.txid))
    const m = mine.value
    for (const tx of page) {
      if (seen.has(tx.txid)) continue
      const c = classifyWalletTx(tx, m)
      // В истории показываем только реальные движения монет (получено/отправлено).
      if (c.direction === 'in' || c.direction === 'out') {
        rows.value.push({
          tx,
          direction: c.direction,
          amount: c.amount,
          counterparties: c.counterparties,
        })
      }
    }

    const minHeight = page.reduce((mn, t2) => Math.min(mn, t2.height), Number.POSITIVE_INFINITY)
    if (Number.isFinite(minHeight) && minHeight > 0) {
      nextCursorHeight = minHeight - 1
    } else {
      hasMore.value = false
    }
    if (page.length < TX_PAGE_SIZE) hasMore.value = false
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// Live тикер для относительного времени.
const now = ref(Math.floor(Date.now() / 1000))
let tickHandle: number | null = null

onMounted(() => {
  loadPage(true)
  tickHandle = window.setInterval(() => {
    now.value = Math.floor(Date.now() / 1000)
  }, 1000)
})

onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})

watch(mainAddress, () => loadPage(true))
</script>
