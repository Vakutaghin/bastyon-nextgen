/**
 * Транзакции, которые ушли в сеть и ждут блока, — для «песочных часов» в шапке:
 * - продвижение, переводы, донаты и оплаты;
 * - правки и удаления, оценки комментариев;
 * - профиль и регистрация, подписки, блокировки, жалобы.
 * Новые посты и комментарии здесь тоже отслеживаются, но в часах их показывают
 * свои сторы (pending-posts, comments) — с текстом; они узнают о блоке по
 * onTransactionSettled. Оценки постов проверяет pending-ratings.
 *
 * Отправку сообщает transaction-sender (broadcast-events), так что новая
 * операция попадёт сюда сама. Ожидание снимается, когда транзакция в блоке:
 * событие WS по txid или проверка ноды (getrawtransaction) — по таймеру, на
 * каждом новом блоке, после переподключения WS и при возврате в приложение:
 * событие WS по адресу теряется, если сокет в это время был закрыт. Не
 * подтвердилась за час (отложенный пост — за час после своего времени) —
 * убираем, чтобы часы не висели вечно. Список хранится по аккаунтам: ожидание
 * переживает перезапуск.
 */

import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
  notifyTransactionSettled,
  onTransactionBroadcast,
  type BroadcastedTransaction,
  type PendingKind,
  type PendingMeta,
} from '@/blockchain/core/transactions/broadcast-events'
import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { wsService } from '@/blockchain/ws/ws-service'

export interface PendingTransaction {
  txid: string
  kind: PendingKind
  createdAt: number
  /** Отложенный пост: раньше этого времени (мс) в блок не попадёт. */
  notBefore?: number
  postId?: string
  address?: string
  title?: string
  amount?: number
  /** Оценка комментария: какого и с каким знаком. */
  commentId?: string
  score?: 1 | -1
}

const STORAGE_PREFIX = 'BST_PENDING_TX_'
export const PENDING_TX_TTL_MS = 60 * 60 * 1000
/** Как часто спрашивать ноду, если WS подтверждение не принёс. */
export const PENDING_TX_CHECK_MS = 20_000
/** Сколько транзакций проверять за раз. */
const CHECK_BATCH = 10

/** Их показывают свои сторы с текстом поста и комментария; здесь — только ожидание блока. */
const SHOWN_ELSEWHERE: ReadonlySet<PendingKind> = new Set<PendingKind>(['post', 'comment'])

/** До какого времени ждать блока: час, у отложенного поста — час после его времени. */
export function pendingDeadline(item: Pick<PendingTransaction, 'createdAt' | 'notBefore'>): number {
  return Math.max(item.createdAt, item.notBefore ?? 0) + PENDING_TX_TTL_MS
}

/** Вид ожидания по типу транзакции; подпись отправителя важнее. */
export function pendingKindOf(operationType: string, meta: PendingMeta): PendingKind {
  if (meta.kind) return meta.kind
  switch (operationType) {
    case 'contentBoost':
      return 'boost'
    case 'transaction':
      return 'transfer'
    case 'userInfo':
      return 'profile'
    case 'subscribe':
    case 'subscribePrivate':
      return 'subscribe'
    case 'unsubscribe':
      return 'unsubscribe'
    case 'blocking':
      return 'block'
    case 'unblocking':
      return 'unblock'
    case 'modFlag':
      return 'complaint'
    case 'contentDelete':
      return 'postDelete'
    case 'commentDelete':
      return 'commentDelete'
    case 'commentEdit':
      return 'commentEdit'
    case 'cScore':
      return 'commentScore'
    case 'collection':
      return 'collection'
    default:
      return 'other'
  }
}

/** Транзакция в блоке: у подробного getrawtransaction есть blockhash или подтверждения. */
function isConfirmed(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const tx = data as { blockhash?: unknown; confirmations?: unknown }
  return (
    (typeof tx.blockhash === 'string' && tx.blockhash.length > 0) ||
    (typeof tx.confirmations === 'number' && tx.confirmations > 0)
  )
}

function readStored(address: string): PendingTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address)
    const list = raw ? (JSON.parse(raw) as PendingTransaction[]) : []
    return Array.isArray(list) ? list.filter((i) => i && typeof i.txid === 'string') : []
  } catch {
    return []
  }
}

function writeStored(address: string, items: PendingTransaction[]): void {
  try {
    if (items.length) localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(items))
    else localStorage.removeItem(STORAGE_PREFIX + address)
  } catch {
    // Хранилище недоступно — ожидание живёт до перезапуска.
  }
}

export const usePendingTransactionsStore = defineStore('pending-transactions', () => {
  const items = ref<PendingTransaction[]>([])
  /** Аккаунт, чьи ожидания на экране. */
  const owner = ref<string | null>(null)

  let stopBroadcast: (() => void) | null = null
  let stopWs: (() => void) | null = null
  let stopBlock: (() => void) | null = null
  let stopOpen: (() => void) | null = null
  let stopVisibility: (() => void) | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let checking = false
  /** Проверку попросили, пока шла прежняя: повторить сразу после неё. */
  let checkAgain = false

  /** Что показывать в часах: посты и комментарии показывают свои сторы. */
  const listed = computed(() => items.value.filter((i) => !SHOWN_ELSEWHERE.has(i.kind)))
  const count = computed(() => listed.value.length)

  const persist = () => {
    if (owner.value) writeStored(owner.value, items.value)
  }

  function add(tx: BroadcastedTransaction): void {
    if (!owner.value || items.value.some((i) => i.txid === tx.txid)) return
    const { meta } = tx
    items.value = [
      ...items.value,
      {
        txid: tx.txid,
        kind: pendingKindOf(tx.operationType, meta),
        createdAt: Date.now(),
        ...(meta.notBefore ? { notBefore: meta.notBefore } : {}),
        ...(meta.postId ? { postId: meta.postId } : {}),
        ...(meta.address ? { address: meta.address } : {}),
        ...(meta.title ? { title: meta.title } : {}),
        ...(meta.amount ? { amount: meta.amount } : {}),
        ...(meta.commentId && meta.score ? { commentId: meta.commentId, score: meta.score } : {}),
      },
    ]
    persist()
    ensureTimer()
  }

  /** Транзакция в блоке — ожидание снято. */
  function confirm(txid: string): void {
    if (!txid || !items.value.some((i) => i.txid === txid)) return
    items.value = items.value.filter((i) => i.txid !== txid)
    persist()
    ensureTimer()
    notifyTransactionSettled(txid, true)
  }

  function cleanupExpired(now: number = Date.now()): void {
    const fresh = items.value.filter((i) => now < pendingDeadline(i))
    if (fresh.length === items.value.length) return
    const expired = items.value.filter((i) => !fresh.includes(i))
    items.value = fresh
    persist()
    for (const item of expired) notifyTransactionSettled(item.txid, false)
  }

  /** Спросить ноду про самые старые ожидания: WS мог подтверждение пропустить. */
  async function checkWithNode(): Promise<void> {
    if (checking) {
      checkAgain = true
      return
    }
    checking = true
    try {
      cleanupExpired()
      const now = Date.now()
      // Отложенный пост до своего времени в блок не попадёт — ноду не дёргаем.
      const batch = items.value
        .filter((i) => !i.notBefore || i.notBefore <= now)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, CHECK_BATCH)
      for (const item of batch) {
        try {
          const res = await getByPRC({
            method: rpcEndpoints.getRawTransaction,
            parameters: [item.txid, 1],
            options: { auth: false, timeout: 15_000 },
            cachehash: `${item.txid}-${Date.now()}`,
          })
          const data =
            res && typeof res === 'object' && 'data' in res ? (res as { data?: unknown }).data : res
          if (isConfirmed(data)) confirm(item.txid)
        } catch {
          // Нода не знает или не ответила — спросим в следующий раз.
        }
      }
    } finally {
      checking = false
      if (checkAgain) {
        checkAgain = false
        void checkWithNode()
      }
    }
  }

  /** Есть чего ждать — спросить ноду сейчас, не дожидаясь таймера. */
  function checkSoon(): void {
    if (items.value.length) void checkWithNode()
  }

  function ensureTimer(): void {
    if (items.value.length && !timer) {
      timer = setInterval(() => void checkWithNode(), PENDING_TX_CHECK_MS)
    } else if (!items.value.length && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /**
   * Показать ожидания аккаунта (с прошлого запуска тоже) и слушать новые
   * отправки и подтверждения. Зовётся при каждой смене адреса (вход, смена
   * аккаунта, выход — null); тот же адрес ничего не меняет.
   */
  function init(address: string | null): void {
    if (!stopBroadcast) stopBroadcast = onTransactionBroadcast(add)
    if (!stopWs) {
      stopWs = wsService.on('transaction', (data) => {
        const txid = (data?.txid as string | undefined) || ''
        if (txid) confirm(txid)
      })
    }
    // Новый блок — наши транзакции могли в него попасть; сокет переподключился —
    // события по адресу, пришедшие без нас, потеряны.
    if (!stopBlock) stopBlock = wsService.on('block', checkSoon)
    if (!stopOpen) stopOpen = wsService.on('open', checkSoon)
    // Вернулись в приложение: таймер в фоне (телефон, свёрнутое окно) стоял.
    if (!stopVisibility && typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') checkSoon()
      }
      document.addEventListener('visibilitychange', onVisible)
      stopVisibility = () => document.removeEventListener('visibilitychange', onVisible)
    }
    if (address === owner.value) return
    owner.value = address
    items.value = address ? readStored(address) : []
    cleanupExpired()
    ensureTimer()
    if (items.value.length) void checkWithNode()
  }

  onScopeDispose(() => {
    stopBroadcast?.()
    stopWs?.()
    stopBlock?.()
    stopOpen?.()
    stopVisibility?.()
    if (timer) clearInterval(timer)
  })

  /** Своя оценка комментария, которая ещё ждёт блока; null — такой нет. */
  function commentScoreOf(commentId: string): 1 | -1 | null {
    if (!commentId) return null
    for (const item of items.value) {
      if (item.kind === 'commentScore' && item.commentId === commentId && item.score) {
        return item.score
      }
    }
    return null
  }

  return {
    items,
    listed,
    owner,
    count,
    init,
    add,
    confirm,
    cleanupExpired,
    checkWithNode,
    commentScoreOf,
  }
})
