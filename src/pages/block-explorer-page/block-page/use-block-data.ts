/**
 * Доменный composable для block-page: RPC (block details + tx page),
 * пагинация транзакций, live-tip → confirmations, label-форматтеры,
 * helper-функции для строки tx и переходов. CODE_AUDIT.md §1.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Router } from 'vue-router'
import {
  useBlockDetails,
  useBlockTransactions,
  useNodeInfo,
} from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
import {
  formatExplorerNumber as formatNumber,
  formatExplorerPkoin,
} from '../components/shared/format-explorer'
import { labelForTxType } from '../components/shared/tx-type-labels'
import { extractCoinstakeInfo, calcConfirmations } from '../components/shared/extract-coinstake'
import { recordVisit } from '../components/shared/use-search-history'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import { t } from '@/i18n'
import type { Transaction } from '@/types/rpc-responses/get-transactions'

const TX_PAGE_SIZE = 50

// Тип возвращаемого значения вынесен в `ReturnType<typeof useBlockData>` —
// это избавляет от ручного синка интерфейса с реальной формой `block`/`txList`,
// которая зависит от шейпа RPC-ответа.
export function useBlockData(hashOrHeightRef: Ref<string>, router: Router) {
  const {
    data: blockResp,
    isLoading: blockLoading,
    error: blockError,
  } = useBlockDetails(hashOrHeightRef)
  const block = computed(() => blockResp.value?.data)

  // Регистрируем визит, когда блок реально загрузился. Сохраняем то, что было в URL
  // (height или hash) — пусть автокомплит соответствует тому, что вводил пользователь.
  // Заодно подменяем URL на канонический permalink (план §5.5): если открыли по
  // высоте, меняем её на иммутабельный hash блока. Hash не зависит от chain-state,
  // поэтому share-ссылка переживёт реорганизации цепочки.
  watch(
    () => block.value?.hash,
    (h) => {
      if (!h) return
      recordVisit(hashOrHeightRef.value, 'block')
      if (/^\d+$/.test(hashOrHeightRef.value) && hashOrHeightRef.value !== h) {
        router.replace({ name: 'explorer-block', params: { hashOrHeight: h } })
      }
    }
  )

  const blockHash = computed(() => block.value?.hash ?? '')

  const txCount = ref(TX_PAGE_SIZE)

  // Сбрасываем счётчик показа при переходе на другой блок.
  watch(blockHash, () => {
    txCount.value = TX_PAGE_SIZE
  })

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

  function loadMoreTx(): void {
    const total = block.value?.nTx ?? Number.POSITIVE_INFINITY
    txCount.value = Math.min(txCount.value + TX_PAGE_SIZE, total)
  }

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
    if (!coinstakeInfo.value) return t('explorerPage.blockMetaStaker')
    return coinstakeInfo.value.kind === 'pow'
      ? t('explorerPage.blockMetaMinerPow')
      : t('explorerPage.blockMetaStakerPos')
  })

  const prevHash = computed(() => block.value?.prevhash ?? '')
  const nextHash = computed(() => block.value?.nexthash ?? '')

  const heightLabel = computed(() => {
    if (block.value) return `#${formatNumber(block.value.height)}`
    // если параметр — число, покажем сразу
    return /^\d+$/.test(hashOrHeightRef.value)
      ? `#${formatNumber(Number(hashOrHeightRef.value))}`
      : t('explorerPage.ellipsis')
  })

  const difficultyLabel = computed(() => {
    const d = block.value?.difficulty
    return d ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(d) : t('explorerPage.em')
  })

  const pagerLabel = computed(() => {
    const total = block.value?.nTx ?? 0
    const shown = txList.value.length
    return total > 0 ? t('explorerPage.blockTxPager', { shown, total }) : ''
  })

  const blockErrorMessage = computed(() => {
    const e = blockError.value
    if (!e) return ''
    const msg = extractErrorMessage(e)
    if (msg.toLowerCase().includes('block not found')) {
      return t('explorerPage.blockNotFound')
    }
    return t('explorerPage.blockErrorPrefix', { msg })
  })

  const loadMoreLabel = computed(() => {
    const total = block.value?.nTx ?? 0
    const remaining = Math.max(0, total - txList.value.length)
    const next = Math.min(TX_PAGE_SIZE, remaining)
    return next > 0 ? t('explorerPage.blockLoadMoreNext', { next }) : t('explorerPage.loadMore')
  })

  function typeLabel(type: number): string {
    return labelForTxType(type)
  }

  function txTotalLabel(tx: Transaction): string {
    const sum = (tx.vout ?? []).reduce((acc, v) => acc + (v.value ?? 0), 0)
    return sum > 0 ? `${formatExplorerPkoin(sum)} PKOIN` : ''
  }

  function goTo(hash: string): void {
    if (!hash) return
    router.push({ name: 'explorer-block', params: { hashOrHeight: hash } })
  }

  // Live тикер — секунды UTC, для пересчёта «N минут назад».
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

  return {
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
  }
}
