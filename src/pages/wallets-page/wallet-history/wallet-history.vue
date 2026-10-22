<template>
  <div>
    <SC_HistoryHint>{{ t('wallet.history.hint') }}</SC_HistoryHint>

    <div v-if="loading && !rows.length">
      <SC_HistoryEmpty>{{ t('wallet.history.loading') }}</SC_HistoryEmpty>
    </div>

    <SC_HistoryError v-else-if="error">
      {{ t('wallet.history.error') }}
    </SC_HistoryError>

    <SC_HistoryEmpty v-else-if="!rows.length && !hasMore">
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
        <SC_HistoryRow :href="href" @click="openTx($event, row.tx.txid, navigate)">
          <SC_DirIcon :class="row.direction">
            <ArrowDownOutlined v-if="row.direction === 'in'" />
            <ArrowUpOutlined v-else />
          </SC_DirIcon>

          <SC_HistoryMid>
            <SC_HistoryDirLabel>
              {{ row.direction === 'in' ? t('wallet.history.received') : t('wallet.history.sent') }}
              <SC_TxBadge v-if="row.semantic" :class="row.semantic">
                {{ t('wallet.history.semantic.' + row.semantic) }}
              </SC_TxBadge>
            </SC_HistoryDirLabel>
            <SC_HistoryCounterparty v-if="row.counterparties.length">
              {{ counterpartyLabel(row) }}
            </SC_HistoryCounterparty>
          </SC_HistoryMid>

          <SC_HistoryAmount :class="row.direction">
            {{ row.direction === 'in' ? '+' : '−' }}{{ formatPkoinAmount(row.amount, 4) }} PKOIN
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
import { fetchAddressTxPage, startAddressTxCursor } from '@/helpers/explorer/address-transactions'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ArrowDownOutlined, ArrowUpOutlined } from '@/components/icons'
import { useAuthStore, getAdditionalWalletAddressesList } from '@/blockchain'
import { useChainInfoStore } from '@/stores/chain-info-store'
import { useUserProfiles } from '@/composables/use-user-profile'
import { formatPkoinAmount } from '@/helpers/common/pkoin-formatter'
import { shortenHash } from '@/pages/block-explorer-page/components/shared/format-explorer'
import {
  formatTimeAgo as formatRelTime,
  formatDateTimeExact as formatAbsTime,
} from '@/helpers/common/date-formatter'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import {
  classifyWalletTx,
  WALLET_HISTORY_TX_TYPES,
  type WalletTxDirection,
  type WalletTxSemantic,
} from './classify-tx'
import {
  SC_History,
  SC_HistoryHint,
  SC_HistoryRow,
  SC_DirIcon,
  SC_HistoryMid,
  SC_HistoryDirLabel,
  SC_TxBadge,
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
  semantic: WalletTxSemantic
}

const TX_PAGE_SIZE = 30
/**
 * Строк за одно нажатие. Нода отдаёт и комментарии без монет — их история
 * пропускает, и страница бывает пустой: тогда сразу просим следующую.
 */
const MIN_NEW_ROWS = 10
/** Потолок запросов за одно нажатие, чтобы не листать всю историю разом. */
const MAX_PAGES_PER_LOAD = 5

const { t } = useI18n()
const authStore = useAuthStore()

/**
 * Операция открывается в модалке «В блокчейне»: закрыл — и история на том
 * же месте, без перезагрузки. С модификатором — сразу в эксплорере.
 */
function openTx(e: MouseEvent, txid: string, navigate: (e?: MouseEvent) => unknown): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    void navigate(e)
    return
  }
  e.preventDefault()
  useChainInfoStore().open({ kind: 'tx', txid })
}

const rows = ref<HistoryRow[]>([])
const loading = ref(false)
const error = ref(false)

// Резолв адреса контрагента в ник (батч getuserprofile + Vue Query кэш).
const uniqueCounterparties = computed<string[]>(() => {
  const set = new Set<string>()
  for (const row of rows.value) {
    const first = row.counterparties[0]
    if (first) set.add(first)
  }
  return [...set]
})
const { data: counterpartyProfiles } = useUserProfiles(uniqueCounterparties, true)
const profileNameByAddress = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const p of counterpartyProfiles.value ?? []) {
    if (p?.address && p.name) map[p.address] = p.name
  }
  return map
})
const hasMore = ref(true)
let cursor = startAddressTxCursor()
/** Номер загрузки: ответ для прежнего аккаунта не должен долиться к новому. */
let generation = 0

const mainAddress = computed<string>(() => authStore.getUserAddress ?? '')

/** Множество всех моих адресов (основной + дополнительные) для определения «своих». */
const mine = computed<ReadonlySet<string>>(() => {
  const cur = mainAddress.value
  if (!cur) return new Set<string>()
  return new Set([cur, ...getAdditionalWalletAddressesList(cur)])
})

/** «от …» / «на …»; у наград и буста контрагента нет — строка не выводится. */
function counterpartyLabel(row: HistoryRow): string {
  const first = row.counterparties[0]
  if (!first) return ''
  // Ник, если профиль уже подгрузился; иначе укороченный адрес.
  const display = profileNameByAddress.value[first] || shortenHash(first, 8, 6)
  const extra = row.counterparties.length - 1
  const base =
    row.direction === 'in'
      ? t('wallet.history.from', { addr: display })
      : t('wallet.history.to', { addr: display })
  return extra > 0 ? `${base} +${extra}` : base
}

async function loadPage(reset = false): Promise<void> {
  if (reset) {
    generation++
    rows.value = []
    cursor = startAddressTxCursor()
    hasMore.value = true
    error.value = false
    loading.value = false
  }
  const addr = mainAddress.value
  if (!addr || !hasMore.value || loading.value) return
  const current = generation
  loading.value = true
  error.value = false
  try {
    const m = mine.value
    let added = 0
    for (let i = 0; i < MAX_PAGES_PER_LOAD && cursor.hasMore && added < MIN_NEW_ROWS; i++) {
      // Нода — общая для приложения, а не закреплённая в настройках эксплорера:
      // та настройка обещает «на остальное приложение не влияет» (S7).
      const page = await fetchAddressTxPage(addr, cursor, {
        pageSize: TX_PAGE_SIZE,
        types: WALLET_HISTORY_TX_TYPES,
      })
      // Пока ходили в ноду, сменился аккаунт — его история уже грузится заново.
      if (current !== generation) return
      cursor = page.cursor
      const seen = new Set(rows.value.map((r) => r.tx.txid))
      for (const tx of page.txs) {
        if (seen.has(tx.txid)) continue
        const c = classifyWalletTx(tx, m)
        // В истории показываем только реальные движения монет (получено/отправлено).
        if (c.direction === 'change') continue
        rows.value.push({
          tx,
          direction: c.direction,
          amount: c.amount,
          counterparties: c.counterparties,
          semantic: c.semantic,
        })
        added++
      }
    }
    hasMore.value = cursor.hasMore
  } catch {
    if (current === generation) error.value = true
  } finally {
    if (current === generation) loading.value = false
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
