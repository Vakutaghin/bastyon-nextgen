<template>
  <SC_BlockPageWork>
    <SC_BlockPagePage>
      <SC_BlockBreadcrumb>
        <RouterLink :to='{ name: "explorer" }'>Эксплорер</RouterLink>
        <span> / Блок</span>
      </SC_BlockBreadcrumb>

      <SC_BlockTitle>
        Блок <span style='font-variant-numeric: tabular-nums;'>{{ heightLabel }}</span>
      </SC_BlockTitle>

      <SC_BlockNav>
        <SC_BlockNavBtn
          type='button'
          :disabled='!prevHash'
          @click='goTo(prevHash)'
        >
          <LeftOutlined :style="{ fontSize: '12px' }" /> Предыдущий
        </SC_BlockNavBtn>
        <SC_BlockNavBtn
          type='button'
          :disabled='!nextHash'
          @click='goTo(nextHash)'
        >
          Следующий <RightOutlined :style="{ fontSize: '12px' }" />
        </SC_BlockNavBtn>
        <ShareButton v-if='block' :title='`Блок ${heightLabel}`' />
      </SC_BlockNav>

      <SC_BlockMetaGrid v-if='blockLoading && !block'>
        <SC_BlockMetaCell v-for='i in 10' :key='`meta-sk-${i}`'>
          <SC_BlockMetaLabel><Skeleton :width='80' :height='10' /></SC_BlockMetaLabel>
          <SC_BlockMetaValue><Skeleton width='80%' :height='16' /></SC_BlockMetaValue>
        </SC_BlockMetaCell>
      </SC_BlockMetaGrid>

      <SC_PlaceholderError v-if='blockError'>
        {{ blockErrorMessage }}
      </SC_PlaceholderError>

      <template v-if='block'>
        <SC_BlockMetaGrid>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Хеш блока
              <InfoTooltip term-key='hash' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <HashLink :hash='block.hash' full />
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Высота
              <InfoTooltip term-key='height' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>#{{ formatNumber(block.height) }}</SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>Время</SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              {{ formatAbsTime(block.time) }}
              <span style='color: rgb(173, 181, 189); font-size: 12px;'>
                ({{ formatRelTime(block.time, now) }})
              </span>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>Транзакций</SC_BlockMetaLabel>
            <SC_BlockMetaValue>{{ block.nTx }}</SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Подтверждений
              <InfoTooltip term-key='confirmations' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <span v-if='confirmations > 0'>
                {{ formatNumber(confirmations) }}
                <span v-if='confirmations === 1' style='font-size: 12px; color: rgb(255, 174, 0);'>
                  · tip
                </span>
              </span>
              <span v-else style='color: rgb(173, 181, 189);'>—</span>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Сложность · bits
              <InfoTooltip term-key='difficulty' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              {{ difficultyLabel }}
              <span style='font-size: 12px; color: rgb(173, 181, 189);'>· {{ block.bits }}</span>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              {{ coinstakeLabel }}
              <InfoTooltip term-key='staker' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <AddressLink v-if='coinstakeInfo' :address='coinstakeInfo.staker' />
              <Skeleton v-else-if='txLoading' :width='180' :height='14' />
              <span v-else style='color: rgb(173, 181, 189);'>—</span>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Награда блока
              <InfoTooltip term-key='blockReward' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <span v-if='coinstakeInfo'>{{ formatExplorerPkoin(coinstakeInfo.reward) }} PKOIN</span>
              <Skeleton v-else-if='txLoading' :width='100' :height='14' />
              <span v-else style='color: rgb(173, 181, 189);'>—</span>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>

          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>
              Merkle root
              <InfoTooltip term-key='merkleRoot' />
            </SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <HashLink :hash='block.merkleroot' full :copyable='true' :to='undefined' />
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
          <SC_BlockMetaCell>
            <SC_BlockMetaLabel>Соседи</SC_BlockMetaLabel>
            <SC_BlockMetaValue>
              <div v-if='block.prevhash' style='margin-bottom: 4px;'>
                ← <HashLink
                  :hash='block.prevhash'
                  :to='{ name: "explorer-block", params: { hashOrHeight: block.prevhash } }'
                />
              </div>
              <div v-if='block.nexthash'>
                → <HashLink
                  :hash='block.nexthash'
                  :to='{ name: "explorer-block", params: { hashOrHeight: block.nexthash } }'
                />
              </div>
              <div v-if='!block.prevhash && !block.nexthash' style='color: rgb(173, 181, 189);'>
                —
              </div>
            </SC_BlockMetaValue>
          </SC_BlockMetaCell>
        </SC_BlockMetaGrid>

        <SC_TxSection>
          <SC_TxSectionHeader>
            <SC_TxSectionTitle>Транзакции в блоке</SC_TxSectionTitle>
            <SC_TxSectionPager>
              {{ pagerLabel }}
            </SC_TxSectionPager>
          </SC_TxSectionHeader>

          <div v-if='txLoading && !txList.length'>
            <SC_TxRow v-for='i in 5' :key='`tx-sk-${i}`'>
              <SC_TxTypeBadge><Skeleton :width='50' :height='12' /></SC_TxTypeBadge>
              <Skeleton width='100%' :height='14' />
              <SC_TxValue><Skeleton :width='80' :height='12' /></SC_TxValue>
            </SC_TxRow>
          </div>
          <SC_PlaceholderError v-else-if='txError'>Не удалось загрузить транзакции</SC_PlaceholderError>
          <SC_Placeholder v-else-if='!txList.length'>Транзакций нет</SC_Placeholder>
          <div v-else>
            <SC_TxRow v-for='tx in txList' :key='tx.txid'>
              <SC_TxTypeBadge>{{ typeLabel(tx.type) }}</SC_TxTypeBadge>
              <HashLink
                :hash='tx.txid'
                :to='{ name: "explorer-tx", params: { txid: tx.txid } }'
              />
              <SC_TxValue>
                {{ txTotalLabel(tx) }}
              </SC_TxValue>
            </SC_TxRow>
            <SC_LoadMoreFooter v-if='canLoadMoreTx'>
              <SC_LoadMoreBtn
                type='button'
                :disabled='txFetching'
                @click='loadMoreTx'
              >
                {{ txFetching ? 'Загрузка…' : `Загрузить ещё ${nextChunkLabel}` }}
              </SC_LoadMoreBtn>
            </SC_LoadMoreFooter>
          </div>
        </SC_TxSection>
      </template>
    </SC_BlockPagePage>
  </SC_BlockPageWork>
</template>

<script setup lang='ts'>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import {
  useBlockDetails,
  useBlockTransactions,
  useNodeInfo,
} from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
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
import { labelForTxType } from '../components/shared/tx-type-labels'
import { extractCoinstakeInfo, calcConfirmations } from '../components/shared/extract-coinstake'
import { recordVisit } from '../components/shared/use-search-history'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
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

defineOptions({ name: 'BlockPage' })

const p = defineProps<{ hashOrHeight: string }>()
const router = useRouter()

const queryInput = computed(() => p.hashOrHeight ?? '')

const {
  data: blockResp,
  isLoading: blockLoading,
  error: blockError,
} = useBlockDetails(queryInput)

const block = computed(() => blockResp.value?.data)

// Регистрируем визит, когда блок реально загрузился. Сохраняем то, что было в URL
// (height или hash) — пусть автокомплит соответствует тому, что вводил пользователь.
watch(
  () => block.value?.hash,
  (h) => { if (h) recordVisit(p.hashOrHeight, 'block') },
)

const blockHash = computed(() => block.value?.hash ?? '')

const TX_PAGE_SIZE = 50
const txCount = ref(TX_PAGE_SIZE)

// Сбрасываем счётчик показа при переходе на другой блок.
watch(blockHash, () => { txCount.value = TX_PAGE_SIZE })

const {
  data: txResp,
  isLoading: txLoading,
  isFetching: txFetching,
  error: txError,
} = useBlockTransactions(blockHash, 0, txCount)

const txList = computed<Transaction[]>(() => txResp.value?.data ?? [])

const canLoadMoreTx = computed(() => {
  const total = block.value?.nTx ?? 0
  return total > txList.value.length
})

function loadMoreTx() {
  const total = block.value?.nTx ?? Number.POSITIVE_INFINITY
  txCount.value = Math.min(txCount.value + TX_PAGE_SIZE, total)
}

const nextChunkLabel = computed(() => {
  const total = block.value?.nTx ?? 0
  const remaining = Math.max(0, total - txList.value.length)
  const next = Math.min(TX_PAGE_SIZE, remaining)
  return next > 0 ? `(${next})` : ''
})

// Подключаем real-time обновление tip-а: confirmations растут на новом блоке.
useExplorerWsUpdates()

const { data: nodeInfo } = useNodeInfo()
const tipHeight = computed(() => nodeInfo.value?.data?.lastblock?.height ?? 0)

const confirmations = computed(() => {
  const h = block.value?.height
  if (h === undefined) return 0
  return calcConfirmations(h, tipHeight.value)
})

const coinstakeInfo = computed(() => extractCoinstakeInfo(txList.value))

const coinstakeLabel = computed(() => {
  if (!coinstakeInfo.value) return 'Стейкер'
  return coinstakeInfo.value.kind === 'pow' ? 'Майнер (PoW)' : 'Стейкер (PoS)'
})

const prevHash = computed(() => block.value?.prevhash ?? '')
const nextHash = computed(() => block.value?.nexthash ?? '')

const heightLabel = computed(() => {
  if (block.value) return `#${formatNumber(block.value.height)}`
  // если параметр — число, покажем сразу
  return /^\d+$/.test(p.hashOrHeight) ? `#${formatNumber(Number(p.hashOrHeight))}` : '…'
})

const difficultyLabel = computed(() => {
  const d = block.value?.difficulty
  return d ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(d) : '—'
})

const pagerLabel = computed(() => {
  const total = block.value?.nTx ?? 0
  const shown = txList.value.length
  return total > 0 ? `Показано ${shown} из ${total}` : ''
})

const blockErrorMessage = computed(() => {
  const e = blockError.value
  if (!e) return ''
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.toLowerCase().includes('block not found')) {
    return 'Блок не найден. Возможно, это txid — попробуйте открыть как транзакцию.'
  }
  return `Ошибка загрузки блока: ${msg}`
})

function typeLabel(type: number): string {
  return labelForTxType(type)
}

function txTotalLabel(tx: Transaction): string {
  const sum = (tx.vout ?? []).reduce((s, v) => s + (v.value ?? 0), 0)
  return sum > 0 ? `${formatExplorerPkoin(sum)} PKOIN` : ''
}

function goTo(hash: string) {
  if (!hash) return
  router.push({ name: 'explorer-block', params: { hashOrHeight: hash } })
}

// Live тикер для пересчёта «N минут назад».
const now = ref(Math.floor(Date.now() / 1000))
let tickHandle: number | null = null
onMounted(() => {
  tickHandle = window.setInterval(() => { now.value = Math.floor(Date.now() / 1000) }, 1000)
})
onBeforeUnmount(() => {
  if (tickHandle !== null) window.clearInterval(tickHandle)
})
</script>
