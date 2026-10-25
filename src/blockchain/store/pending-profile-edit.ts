/**
 * Правка своего профиля, пока её транзакция не в блоке.
 *
 * До блока нода отдаёт прежний профиль, и любой новый запрос (шапка,
 * страница профиля) возвращал старый аватар и имя: казалось, что аватар не
 * сменился. Правка накладывается поверх ответа ноды, пока транзакция не
 * подтвердится, нода сама не отдаст новые имя и аватар или не пройдёт час,
 * как у ожиданий в шапке (pending-transactions-store). Хранится по
 * аккаунтам: переживает перезапуск.
 */

import { onTransactionSettled } from '../core/transactions/broadcast-events'
import type { UserProfile } from '../../types/rpc-responses/user-get'

interface PendingProfileEdit {
  txid: string
  patch: Partial<UserProfile>
  at: number
}

const STORAGE_PREFIX = 'BST_PENDING_PROFILE_'
/** Столько же ждёт подтверждения pending-transactions-store. */
const TTL_MS = 60 * 60 * 1000

function read(address: string): PendingProfileEdit | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address)
    const edit = raw ? (JSON.parse(raw) as PendingProfileEdit) : null
    if (!edit || typeof edit.txid !== 'string' || !edit.patch) return null
    if (Date.now() - edit.at >= TTL_MS) {
      localStorage.removeItem(STORAGE_PREFIX + address)
      return null
    }
    return edit
  } catch {
    return null
  }
}

function drop(address: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + address)
  } catch {
    // Хранилище недоступно — и правки там нет.
  }
}

/** Запомнить отправленную правку профиля `address`. */
export function holdProfileEdit(address: string, txid: string, patch: Partial<UserProfile>): void {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + address,
      JSON.stringify({ txid, patch, at: Date.now() } satisfies PendingProfileEdit)
    )
  } catch {
    // Без хранилища правка видна до следующего запроса профиля.
  }
}

/**
 * Профиль с ноды с наложенной неподтверждённой правкой. Если нода уже
 * отдаёт новые имя и аватар, правка больше не нужна.
 */
export function withPendingProfileEdit<T extends { address?: string } | null | undefined>(
  data: T
): T {
  const address = data?.address
  if (!data || !address) return data
  const edit = read(address)
  if (!edit) return data
  const node = data as Partial<UserProfile>
  const { name, i } = edit.patch
  if ((name === undefined || node.name === name) && (i === undefined || (node.i ?? '') === i)) {
    drop(address)
    return data
  }
  return { ...data, ...edit.patch }
}

// Транзакция в блоке или не дождалась часа — правка больше не накладывается.
onTransactionSettled((txid) => {
  try {
    for (let n = localStorage.length - 1; n >= 0; n -= 1) {
      const key = localStorage.key(n)
      if (!key?.startsWith(STORAGE_PREFIX)) continue
      const address = key.slice(STORAGE_PREFIX.length)
      if (read(address)?.txid === txid) drop(address)
    }
  } catch {
    // Хранилище недоступно.
  }
})
