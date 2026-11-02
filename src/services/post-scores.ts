/**
 * Кто и как оценил пост — окно по числу оценок под звёздами, как в прежнем
 * Bastyon (components/postscores): сверху доли оценок от 5 до 1, ниже люди с
 * их оценкой; те, на кого вы подписаны, — первыми, дальше по репутации.
 *
 * Нода отдаёт список `getpostscores [txid]`: адрес, имя, аватар, репутация,
 * оценка. Своя оценка попадает туда только с блоком — до того её добавляем
 * сами, как старый клиент добавлял неподтверждённые.
 */

import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { resolveAvatarUrl } from '@/helpers/common/avatar-resolver'

export interface PostScoreRow {
  address: string
  name: string
  avatar: string | null
  /** Нет у аккаунтов без репутации — тогда не показываем. */
  reputation: number | null
  /** 1…5 звёзд. */
  value: number
}

interface RawPostScore {
  address?: unknown
  name?: unknown
  avatar?: unknown
  reputation?: unknown
  value?: unknown
}

/** Ответ ноды → строки: оценки 1…5, по одной на человека. */
export function normalizePostScores(raw: unknown): PostScoreRow[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const rows: PostScoreRow[] = []
  for (const item of raw as RawPostScore[]) {
    const address = typeof item?.address === 'string' ? item.address : ''
    const value = Number(item?.value)
    if (!address || seen.has(address) || !Number.isInteger(value) || value < 1 || value > 5) {
      continue
    }
    seen.add(address)
    const reputation = Number(item.reputation)
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    rows.push({
      address,
      name: name || `${address.slice(0, 8)}…`,
      avatar: resolveAvatarUrl({ avatar: item.avatar }) ?? null,
      reputation: item.reputation !== undefined && Number.isFinite(reputation) ? reputation : null,
      value,
    })
  }
  return rows
}

/** Своя оценка, которой у ноды ещё нет (ждёт блока), — в список. */
export function withOwnScore(
  rows: readonly PostScoreRow[],
  own: { address: string; name: string; avatar: string | null; value: number } | null
): PostScoreRow[] {
  if (!own || !own.address || own.value < 1 || rows.some((r) => r.address === own.address)) {
    return [...rows]
  }
  return [...rows, { ...own, reputation: null }]
}

/** Сначала те, на кого вы подписаны, дальше — по репутации. */
export function sortPostScores(
  rows: readonly PostScoreRow[],
  isSubscribed: (address: string) => boolean
): PostScoreRow[] {
  return [...rows].sort((a, b) => {
    const followed = Number(isSubscribed(b.address)) - Number(isSubscribed(a.address))
    return followed || (b.reputation ?? -1) - (a.reputation ?? -1)
  })
}

export interface ScoreShare {
  stars: number
  count: number
  /** Доля от всех оценок, 0…100. */
  percent: number
}

/** Доли оценок от 5 до 1 — полосы над списком. */
export function scoreDistribution(rows: readonly PostScoreRow[]): ScoreShare[] {
  const total = rows.length
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = rows.filter((r) => r.value === stars).length
    return { stars, count, percent: total ? Math.round((count / total) * 100) : 0 }
  })
}

export async function fetchPostScores(txid: string): Promise<PostScoreRow[]> {
  const data = await rpcCall<unknown>({
    method: rpcEndpoints.getPostScores,
    parameters: [txid],
    options: { auth: false },
  })
  return normalizePostScores(data)
}
