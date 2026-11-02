/**
 * Загрузка статистики с ноды.
 *
 * Сутки за длинный период нода одним запросом не считает: за полгода и больше
 * — «GetTransactionsStatisticByDays: sql request timeout» через 11 с, 30 суток
 * загруженного 2024–2025 года тоже падали, а 10 суток в любом году приходят
 * за 1–5 с (замер 02.11.2026). Поэтому сутки берём кусками по 10, выровненными
 * по номеру суток ноды: кусок `k` — сутки [10k, 10k + 10). Прошлые куски не
 * меняются — они ложатся в IndexedDB, и второй раз «Всё время» открывается
 * без запросов. Часы — одним запросом: нода отдаёт не больше 168.
 */

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import type { GetStatisticResponse } from '@/types/rpc-responses/get-statistic'
import { DAY_BLOCKS } from './chain-time'
import type { Buckets } from './stats-model'

export const CHUNK_DAYS = 10
/** Вершина «по умолчанию»: нода берёт меньшее из этого и своей высоты. */
const TIP = 9_999_999

/** Куски, покрывающие сутки ноды [fromDay, toDay], от свежих к старым. */
export function chunksFor(fromDay: number, toDay: number): number[] {
  const first = Math.max(0, Math.floor(fromDay / CHUNK_DAYS))
  const last = Math.floor(toDay / CHUNK_DAYS)
  const out: number[] = []
  for (let k = last; k >= first; k--) out.push(k)
  return out
}

/** Кусок закончился: его последние сутки раньше текущих суток ноды. */
export function isChunkFinal(chunk: number, currentDay: number): boolean {
  return (chunk + 1) * CHUNK_DAYS <= currentDay
}

async function rpc<T>(method: string, parameters: unknown[]): Promise<T> {
  const response = (await getByPRC(
    { method, parameters, options: { auth: false } },
    getExplorerRpcConfig()
  )) as { data?: unknown } | null
  return (response?.data ?? null) as T
}

export function fetchDayChunk(chunk: number): Promise<Buckets> {
  return rpc<Buckets>(rpcEndpoints.getStatisticByDays, [
    (chunk + 1) * CHUNK_DAYS * DAY_BLOCKS,
    CHUNK_DAYS,
  ]).then((data) => data ?? {})
}

export function fetchHours(hours = 168): Promise<Buckets> {
  return (
    getByPRC(
      {
        method: rpcEndpoints.getStatisticByHours,
        parameters: [TIP, Math.min(168, hours)],
        options: { auth: false },
      },
      getExplorerRpcConfig()
    ) as Promise<GetStatisticResponse>
  ).then((r) => r?.data ?? {})
}

/**
 * Сколько аккаунтов было в сети на конец каждого часа последней недели
 * (getstatisticcontentbyhours). По суткам тот же метод на нодах не укладывается
 * в таймаут даже за один день.
 */
export async function fetchAccountsByHour(hours = 168): Promise<Record<string, number>> {
  const data = await rpc<Record<string, unknown>>(rpcEndpoints.getStatisticContentByHours, [
    TIP,
    Math.min(168, hours),
  ])
  const out: Record<string, number> = {}
  for (const [hour, value] of Object.entries(data ?? {})) {
    const n = Number(value)
    if (Number.isFinite(n)) out[hour] = n
  }
  return out
}

/** Выпущено монет к блоку `height` (getcoininfo). */
export async function fetchEmission(height: number): Promise<number | null> {
  const data = await rpc<{ emission?: unknown } | null>(rpcEndpoints.getCoinInfo, [height])
  const n = Number(data?.emission)
  return Number.isFinite(n) ? n : null
}

/** Сложность стейкинга блока `height` (getcompactblock по высоте). */
export async function fetchDifficulty(height: number): Promise<number | null> {
  const data = await rpc<{ difficulty?: unknown } | null>(rpcEndpoints.getCompactBlock, [
    '',
    height,
  ])
  const n = Number(data?.difficulty)
  return Number.isFinite(n) ? n : null
}

/** Запускает задачи не больше чем по `limit` разом; ошибка одной не роняет другие. */
export async function runLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!
      try {
        await task(item)
      } catch {
        /* задача сама решает, что делать со сбоем */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// --- Кэш неизменной истории (IndexedDB) ------------------------------------

const CACHE_DB = 'explorer-stats'
const STORE = 'history'

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Значения по ключам; чего нет или хранилище недоступно — того нет в ответе. */
export async function readHistory<T>(keys: readonly string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>()
  if (!keys.length || typeof indexedDB === 'undefined') return out
  try {
    const idb = await openCache()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(STORE)
        const store = tx.objectStore(STORE)
        for (const key of keys) {
          const req = store.get(key)
          req.onsuccess = () => {
            if (req.result !== undefined) out.set(key, req.result as T)
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      idb.close()
    }
  } catch {
    /* приватное окно или запрет хранилища — просто спросим ноду */
  }
  return out
}

export async function writeHistory(entries: ReadonlyMap<string, unknown>): Promise<void> {
  if (!entries.size || typeof indexedDB === 'undefined') return
  try {
    const idb = await openCache()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        for (const [key, value] of entries) store.put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      idb.close()
    }
  } catch {
    /* не сохранилось — в следующий раз спросим ноду снова */
  }
}
