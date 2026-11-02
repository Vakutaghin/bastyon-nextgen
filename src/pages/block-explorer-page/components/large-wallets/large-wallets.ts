/**
 * «Крупные кошельки»: чистая логика — кэши, кандидаты, строки таблицы.
 *
 * Списка «топ балансов» у сети нет: в pocketnet.core 0.22 такого метода нет, а
 * публичный прокси пропускает только свой белый список. Поэтому кандидаты —
 * стейкеры последних блоков (в PoS чем больше монет, тем чаще кошелёк создаёт
 * блок) и недавно активные адреса; баланс каждого — `getaddressinfo`.
 * Замер 02.11.2026: 240 блоков — 115 стейкеров, крупнейший — 778 950 PKOIN,
 * вместе — 4,39 млн из 18,85 млн выпущенных.
 */

import type { ActiveAddress } from '../top-addresses/aggregate-active-addresses'

/** Сколько последних блоков проверяем на стейкеров. */
export const STAKER_BLOCKS = 100
/** Сколько самых активных адресов добавляем к стейкерам. */
export const ACTIVE_CANDIDATES = 30
/** Блок → стейкер: блоки неизменны, держим последние 2000 записей. */
export const STAKER_CACHE_LIMIT = 2000
export const STAKER_CACHE_KEY = 'explorer.largeWallets.stakers.v1'
/** Балансы меняются: показываем сохранённые сразу, старше 10 минут — переспрашиваем. */
export const BALANCE_CACHE_LIMIT = 1000
export const BALANCE_CACHE_KEY = 'explorer.largeWallets.balances.v1'
export const BALANCE_FRESH_MS = 10 * 60_000

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** localStorage, если он есть и доступен (в приватном окне бросает). */
export function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): void {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Квота или запрет хранилища: кэш — удобство, без него всё работает.
  }
}

/** Последние `limit` записей Map (порядок вставки = порядок свежести). */
function lastEntries<V>(map: Map<string, V>, limit: number): [string, V][] {
  const entries = [...map]
  return entries.length > limit ? entries.slice(entries.length - limit) : entries
}

/** Кэш «хеш блока → адрес стейкера». */
export function readStakerCache(storage: StorageLike | null): Map<string, string> {
  const raw = readJson(storage, STAKER_CACHE_KEY)
  const out = new Map<string, string>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (!Array.isArray(item)) continue
    const [hash, staker] = item as unknown[]
    if (typeof hash === 'string' && hash && typeof staker === 'string' && staker) {
      out.set(hash, staker)
    }
  }
  return out
}

export function writeStakerCache(storage: StorageLike | null, cache: Map<string, string>): void {
  writeJson(storage, STAKER_CACHE_KEY, lastEntries(cache, STAKER_CACHE_LIMIT))
}

export interface CachedBalance {
  balance: number
  /** Когда узнали, мс. */
  at: number
}

/** Кэш «адрес → баланс и когда его узнали». */
export function readBalanceCache(storage: StorageLike | null): Map<string, CachedBalance> {
  const raw = readJson(storage, BALANCE_CACHE_KEY)
  const out = new Map<string, CachedBalance>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (!Array.isArray(item)) continue
    const [address, balance, at] = item as unknown[]
    if (
      typeof address === 'string' &&
      address &&
      typeof balance === 'number' &&
      Number.isFinite(balance) &&
      typeof at === 'number' &&
      Number.isFinite(at)
    ) {
      out.set(address, { balance, at })
    }
  }
  return out
}

export function writeBalanceCache(
  storage: StorageLike | null,
  cache: Map<string, CachedBalance>
): void {
  const entries = lastEntries(cache, BALANCE_CACHE_LIMIT).map(
    ([address, { balance, at }]) => [address, balance, at] as const
  )
  writeJson(storage, BALANCE_CACHE_KEY, entries)
}

/** Баланс пора переспросить: не знаем его или узнали давно. */
export function isBalanceStale(cached: CachedBalance | undefined, now: number): boolean {
  return !cached || now - cached.at > BALANCE_FRESH_MS
}

/** Сколько блоков из проверенных создал каждый адрес. */
export function countStakes(
  hashes: readonly string[],
  stakerByHash: ReadonlyMap<string, string>
): Map<string, number> {
  const out = new Map<string, number>()
  for (const hash of hashes) {
    const staker = stakerByHash.get(hash)
    if (staker) out.set(staker, (out.get(staker) ?? 0) + 1)
  }
  return out
}

export interface WalletCandidate {
  address: string
  /** Сколько из проверенных блоков создал; 0 — не стейкал. */
  stakedBlocks: number
  /** Есть среди самых активных адресов последних блоков. */
  active: boolean
}

/** Стейкеры и первые `ACTIVE_CANDIDATES` активных адресов, без повторов. */
export function mergeCandidates(
  stakes: ReadonlyMap<string, number>,
  active: readonly ActiveAddress[] | null | undefined
): WalletCandidate[] {
  const byAddress = new Map<string, WalletCandidate>()
  for (const [address, stakedBlocks] of stakes) {
    byAddress.set(address, { address, stakedBlocks, active: false })
  }
  for (const row of (active ?? []).slice(0, ACTIVE_CANDIDATES)) {
    if (!row.address) continue
    const known = byAddress.get(row.address)
    if (known) known.active = true
    else byAddress.set(row.address, { address: row.address, stakedBlocks: 0, active: true })
  }
  return [...byAddress.values()]
}

/** Доля эмиссии в процентах; без эмиссии — null. */
export function emissionShare(balance: number, emission: number | null | undefined): number | null {
  if (!emission || !Number.isFinite(emission) || emission <= 0) return null
  if (!Number.isFinite(balance) || balance < 0) return null
  return (balance / emission) * 100
}

export interface WalletRow extends WalletCandidate {
  balance: number
  /** Процент эмиссии; null — эмиссия ещё не пришла. */
  share: number | null
}

/**
 * Строки таблицы: только кандидаты с известным балансом, по убыванию баланса;
 * при равном — кто больше стейкал, потом по адресу, чтобы места не скакали.
 */
export function buildWalletRows(
  candidates: readonly WalletCandidate[],
  balances: ReadonlyMap<string, number>,
  emission: number | null | undefined
): WalletRow[] {
  const rows: WalletRow[] = []
  for (const c of candidates) {
    const balance = balances.get(c.address)
    if (balance === undefined || !Number.isFinite(balance)) continue
    rows.push({ ...c, balance, share: emissionShare(balance, emission) })
  }
  return rows.sort(
    (a, b) =>
      b.balance - a.balance || b.stakedBlocks - a.stakedBlocks || a.address.localeCompare(b.address)
  )
}

/** Сумма балансов строк. */
export function totalBalance(rows: readonly WalletRow[]): number {
  return rows.reduce((sum, r) => sum + r.balance, 0)
}

/** Процент для подписи: меньше 0,01 — «<0.01», иначе до двух знаков. */
export function formatShare(percent: number | null): string {
  if (percent === null) return '—'
  if (percent > 0 && percent < 0.01) return '<0.01%'
  return `${percent.toFixed(2).replace(/\.?0+$/, '')}%`
}
