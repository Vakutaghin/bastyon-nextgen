/**
 * Доменный composable для tx-page: RPC + все computed-производные,
 * live-тикер и forматные хелперы. Шаблон в tx-page.vue остаётся «голым» —
 * только вёрстка и ссылки на эти значения. CODE_AUDIT.md §1.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useTransactionDetails, useNodeInfo } from '@/composables/use-block-explorer-queries'
import { useExplorerWsUpdates } from '@/composables/use-explorer-ws-updates'
import { formatExplorerPkoin } from '../components/shared/format-explorer'
import { labelForTxType } from '../components/shared/tx-type-labels'
import { calcConfirmations } from '../components/shared/extract-coinstake'
import { recordVisit } from '../components/shared/use-search-history'
import { parsePocketnetPayload } from '../components/shared/parse-pocketnet-payload'
import { t } from '@/i18n'
import { extractErrorMessage } from '@/helpers/common/extract-error-message'
import type { Transaction, TxVout } from '@/types/rpc-responses/get-transactions'

export interface TxData {
  tx: ComputedRef<Transaction | undefined>
  txLoading: Ref<boolean>
  txError: Ref<unknown>
  confirmations: ComputedRef<number>
  typeLabel: ComputedRef<string>
  totalIn: ComputedRef<number>
  totalOut: ComputedRef<number>
  feeLabel: ComputedRef<string>
  pocketPayload: ComputedRef<ReturnType<typeof parsePocketnetPayload>>
  payloadKindLabel: ComputedRef<string>
  errorMessage: ComputedRef<string>
  rawJson: ComputedRef<string>
  showRaw: Ref<boolean>
  now: Ref<number>
  firstAddress: (vout: TxVout) => string
}

export function useTxData(txidRef: Ref<string>): TxData {
  const { data: txResp, isLoading: txLoading, error: txError } = useTransactionDetails(txidRef)
  const tx = computed<Transaction | undefined>(() => txResp.value?.data?.[0])

  // Регистрируем визит, когда tx реально загрузилась.
  watch(
    () => tx.value?.txid,
    (id) => {
      if (id) recordVisit(txidRef.value, 'tx')
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
    return tx.value.vin.reduce((acc, v) => acc + (v.value ?? 0), 0)
  })

  const totalOut = computed(() => {
    if (!tx.value) return 0
    return tx.value.vout.reduce((acc, v) => acc + (v.value ?? 0), 0)
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

  const PAYLOAD_KIND_KEY: Record<string, string> = {
    post: 'explorerPage.txPayloadKindPost',
    comment: 'explorerPage.txPayloadKindComment',
    'comment-edit': 'explorerPage.txPayloadKindCommentEdit',
    'upvote-share': 'explorerPage.txPayloadKindUpvoteShare',
    'c-score': 'explorerPage.txPayloadKindCScore',
    subscribe: 'explorerPage.txPayloadKindSubscribe',
    'block-user': 'explorerPage.txPayloadKindBlockUser',
    boost: 'explorerPage.txPayloadKindBoost',
    account: 'explorerPage.txPayloadKindAccount',
  }

  const payloadKindLabel = computed(() => {
    const k = pocketPayload.value?.kind
    return k ? t(PAYLOAD_KIND_KEY[k] ?? k) : ''
  })

  function firstAddress(vout: TxVout): string {
    const a = vout.scriptPubKey?.addresses?.[0]
    return a && a.length > 0 ? a : ''
  }

  const showRaw = ref(false)
  const rawJson = computed(() => (tx.value ? JSON.stringify(tx.value, null, 2) : ''))

  const errorMessage = computed(() => {
    if (txError.value) {
      return t('explorerPage.txErrorPrefix', { msg: extractErrorMessage(txError.value) })
    }
    if (!tx.value && !txLoading.value) {
      return t('explorerPage.txNotFound')
    }
    return ''
  })

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
  }
}
