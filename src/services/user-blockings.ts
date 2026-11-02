/**
 * Кого адрес заблокировал.
 *
 * Раньше список брали из полного профиля (`getuserprofile` без флага `'1'`),
 * но в полном профиле лежат ещё и все подписчики и подписки. У крупных
 * блогеров он весит мегабайты, и нода не успевает его собрать: у Bastyon_Team
 * (205 тыс. подписчиков) — «GetAccountProfiles: sql request timeout» на каждый
 * запрос, у основателя (75 тыс.) — 2,8 МБ за 14 с или тот же таймаут (замер
 * 02.11.2026). `getuserblockings` отдаёт тот же список за полсекунды. Так
 * загружает блокировки и старый клиент.
 */

import { rpcCall } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'

type RawBlocking = string | { address?: string; adddress?: string } | null

/** Ответ ноды → адреса. С флагом `1` нода отдаёт строки, без него — объекты. */
export function normalizeBlockings(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out = new Set<string>()
  for (const item of list as RawBlocking[]) {
    const address = typeof item === 'string' ? item : (item?.address ?? item?.adddress)
    if (typeof address === 'string' && address) out.add(address)
  }
  return [...out]
}

export async function fetchUserBlockings(address: string): Promise<string[]> {
  // legacy: getuserblockings [адрес, '1', '', '', 0, 5000] — `1` значит «только адреса».
  const list = await rpcCall<unknown>({
    method: rpcEndpoints.getUserBlockings,
    parameters: [address, 1, '', '', 0, 5000],
    options: { auth: false },
  })
  return normalizeBlockings(list)
}
