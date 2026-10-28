/**
 * Топ аккаунтов по репутации и по PKOIN.
 *
 * Общего списка аккаунтов по репутации или по балансу у сети нет: среди
 * методов ноды (pocketnet.core 0.22) такого нет, а `gettopaccounts` считает
 * оценённые посты за период и на нодах падает с ошибкой SQL (сверено
 * 28.10.2026). Зато `getusersubscribers(адрес, 'reputation', …, limit)`
 * отдаёт подписчиков аккаунта уже по убыванию репутации, а на самых
 * подписываемых аккаунтах сети подписана почти вся её активная часть. Топ —
 * это объединение самых репутационных подписчиков этих «узлов» и сами узлы.
 * Смещение и направление сортировки нода у этого метода не учитывает —
 * поэтому за один запрос берём сразу `TOP_SIZE`.
 *
 * Баланс нода отдаёт только по одному адресу (`getaddressinfo`), поэтому
 * «по PKOIN» — самые богатые из того же топа по репутации.
 */

import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { UserProfile } from '@/types/rpc-responses/user-get'

/**
 * Самые подписываемые аккаунты сети, чьих подписчиков нода успевает
 * отсортировать (28.10.2026): основатель Pocketnet — 75 тыс. подписчиков,
 * Rubezh — 102 тыс., ValidaForte — 24 тыс., Alex7Tumanov — 9 тыс. У
 * Bastyon_Team их 205 тыс., и нода на нём не укладывается в свой таймаут.
 * Объединение этих узлов совпадает с объединением пяти крупнейших на 97%,
 * один основатель — на 91%.
 */
export const TOP_HUBS: readonly string[] = [
  'PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5',
  'PSBePd5Tx5KG9vxwAzbaDTfjzDbq1GUTYw',
  'PMABcFZc7fcgPZzstJrHeYoWXJGoP3pd7X',
  'PLfHpn9nJe9hKJ7UqvAuPsPUu9RjNpyTrN',
]

/** Сколько аккаунтов в топе. */
export const TOP_SIZE = 300

/** Профили за один запрос: больше нода отвечает ошибкой. */
const PROFILE_BATCH = 10

export interface TopEntry {
  address: string
  /** Репутация в том виде, что в профиле (у подписчиков нода отдаёт её ×10). */
  reputation: number
}

interface SubscriberRow {
  address?: string
  adddress?: string
  reputation?: number | string
}

/**
 * Объединение списков: у адреса — наибольшая репутация, по убыванию, первые
 * `size`. При равной репутации порядок — по адресу, чтобы места не скакали.
 */
export function mergeTop(lists: readonly TopEntry[][], size = TOP_SIZE): TopEntry[] {
  const byAddress = new Map<string, number>()
  for (const list of lists) {
    for (const { address, reputation } of list) {
      if (!address || !Number.isFinite(reputation)) continue
      const known = byAddress.get(address)
      if (known === undefined || reputation > known) byAddress.set(address, reputation)
    }
  }
  return [...byAddress]
    .map(([address, reputation]) => ({ address, reputation }))
    .sort((a, b) => b.reputation - a.reputation || a.address.localeCompare(b.address))
    .slice(0, size)
}

/** Строка подписчика ноды → запись топа; без адреса — null. */
export function subscriberToEntry(row: SubscriberRow): TopEntry | null {
  // У части методов нода пишет поле с опечаткой — `adddress`.
  const address = row.address ?? row.adddress
  const raw = Number(row.reputation)
  if (!address || !Number.isFinite(raw)) return null
  return { address, reputation: raw / 10 }
}

async function hubSubscribers(hub: string): Promise<TopEntry[]> {
  const rows = await rpcCall<SubscriberRow[]>({
    method: rpcEndpoints.getUserSubscribers,
    parameters: [hub, 'reputation', true, 0, TOP_SIZE],
    options: { auth: false },
  })
  return (Array.isArray(rows) ? rows : [])
    .map(subscriberToEntry)
    .filter((e): e is TopEntry => e !== null)
}

/** Профили адресов пачками; кого нода не знает (не зарегистрирован), в ответе нет. */
export async function fetchProfiles(addresses: readonly string[]): Promise<UserProfile[]> {
  const batches: string[][] = []
  for (let i = 0; i < addresses.length; i += PROFILE_BATCH) {
    batches.push(addresses.slice(i, i + PROFILE_BATCH))
  }
  const results = await Promise.all(
    batches.map((batch) =>
      rpcCall<UserProfile[]>({
        method: rpcEndpoints.getUserProfile,
        parameters: [batch, '1'],
        options: { auth: false },
      })
    )
  )
  return results.flatMap((list) => (Array.isArray(list) ? list : []))
}

/**
 * Топ по репутации. Узел, который не ответил, пропускается — топ собирается
 * из остальных; не ответил ни один — ошибка.
 */
export async function fetchTopByReputation(): Promise<{
  entries: TopEntry[]
  profiles: UserProfile[]
}> {
  const [settled, hubProfiles] = await Promise.all([
    Promise.allSettled(TOP_HUBS.map(hubSubscribers)),
    fetchProfiles(TOP_HUBS).catch(() => [] as UserProfile[]),
  ])
  const lists = settled
    .filter((r): r is PromiseFulfilledResult<TopEntry[]> => r.status === 'fulfilled')
    .map((r) => r.value)
  if (lists.length === 0) {
    const failure = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    throw failure?.reason ?? new Error('top accounts: no hub answered')
  }
  const hubs = hubProfiles
    .filter((p) => p?.address && Number.isFinite(Number(p.reputation)))
    .map((p) => ({ address: p.address, reputation: Number(p.reputation) }))
  return { entries: mergeTop([...lists, hubs]), profiles: hubProfiles }
}

/** Баланс адреса в PKOIN. */
export async function fetchBalance(address: string): Promise<number> {
  const info = await rpcCall<{ balance?: number | string }>({
    method: rpcEndpoints.getAddressInfo,
    parameters: [address],
    options: { auth: false },
  })
  const balance = Number(info?.balance)
  if (!Number.isFinite(balance)) throw new Error('top accounts: no balance')
  return balance
}
