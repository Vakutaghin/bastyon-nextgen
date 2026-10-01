/**
 * Отправленные транзакции — для «песочных часов» в шапке
 * (stores/pending-transactions-store): всё, что ушло в сеть, ждёт блока, и
 * человек должен это видеть. Модуль блокчейна про сторы не знает — он
 * сообщает об отправке, стор слушает.
 */

/** Чем подписать ожидание. Пост и человек — ссылки: заголовок и имя подтянутся из кэша. */
export interface PendingMeta {
  /** Вид операции, если по типу транзакции его не понять (донат, оплата, правка поста). */
  kind?: PendingKind
  /** Пост, к которому относится операция. */
  postId?: string
  /** Человек: получатель перевода, автор, на кого подписались. */
  address?: string
  /** Готовая подпись: имя мини-приложения, ник при регистрации. */
  title?: string
  /** Сумма в PKOIN. */
  amount?: number
}

export type PendingKind =
  | 'boost'
  | 'transfer'
  | 'donate'
  | 'payment'
  | 'postEdit'
  | 'postDelete'
  | 'commentEdit'
  | 'commentDelete'
  | 'commentScore'
  | 'pollVote'
  | 'profile'
  | 'registration'
  | 'subscribe'
  | 'unsubscribe'
  | 'block'
  | 'unblock'
  | 'complaint'
  | 'other'

export interface BroadcastedTransaction {
  txid: string
  operationType: string
  meta: PendingMeta
}

/** Подпись из текста: одна строка, не длиннее `max`; статья (JSON Editor.js) не годится. */
export function pendingSnippet(text: unknown, max = 80): string | undefined {
  if (typeof text !== 'string') return undefined
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line || line.startsWith('{')) return undefined
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

type Listener = (tx: BroadcastedTransaction) => void

const listeners = new Set<Listener>()

/** Подписаться на отправленные транзакции; возвращает отписку. */
export function onTransactionBroadcast(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Транзакция ушла в сеть (txid известен). Ошибка слушателя отправку не ломает. */
export function notifyTransactionBroadcast(tx: BroadcastedTransaction): void {
  for (const listener of listeners) {
    try {
      listener(tx)
    } catch (e) {
      console.warn('[broadcast-events] listener failed', e)
    }
  }
}
