/**
 * Транзакции, которые ушли в сеть и ждут блока, — для «песочных часов» в шапке.
 * Новые посты, новые комментарии и оценки постов показывают свои сторы
 * (pending-posts, comments, pending-ratings). Здесь всё остальное:
 * - продвижение, переводы, донаты и оплаты;
 * - правки и удаления, оценки комментариев;
 * - профиль и регистрация, подписки, блокировки, жалобы.
 *
 * Отправку сообщает transaction-sender (broadcast-events), так что новая
 * операция попадёт сюда сама. Ожидание снимается, когда транзакция в блоке:
 * событие WS по txid или проверка ноды (getrawtransaction). Не подтвердилась
 * за час — убираем, чтобы часы не висели вечно. Список хранится по аккаунтам:
 * ожидание переживает перезапуск.
 */

import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
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
  postId?: string
  address?: string
  title?: string
  amount?: number
}

const STORAGE_PREFIX = 'BST_PENDING_TX_'
export const PENDING_TX_TTL_MS = 60 * 60 * 1000
/** Как часто спрашивать ноду, если WS подтверждение не принёс. */
export const PENDING_TX_CHECK_MS = 20_000
/** Сколько транзакций проверять за раз. */
const CHECK_BATCH = 10

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
  let timer: ReturnType<typeof setInterval> | null = null
  let checking = false

  const count = computed(() => items.value.length)

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
        ...(meta.postId ? { postId: meta.postId } : {}),
        ...(meta.address ? { address: meta.address } : {}),
        ...(meta.title ? { title: meta.title } : {}),
        ...(meta.amount ? { amount: meta.amount } : {}),
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
  }

  function cleanupExpired(now: number = Date.now()): void {
    const fresh = items.value.filter((i) => now - i.createdAt < PENDING_TX_TTL_MS)
    if (fresh.length === items.value.length) return
    items.value = fresh
    persist()
  }

  /** Спросить ноду про самые старые ожидания: WS мог подтверждение пропустить. */
  async function checkWithNode(): Promise<void> {
    if (checking) return
    checking = true
    try {
      cleanupExpired()
      const batch = [...items.value].sort((a, b) => a.createdAt - b.createdAt).slice(0, CHECK_BATCH)
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
    }
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
    if (timer) clearInterval(timer)
  })

  return { items, owner, count, init, add, confirm, cleanupExpired, checkWithNode }
})
