/**
 * Репутация под ником в результатах поиска — вместо адреса: по нему человека
 * не узнать, а по репутации видно, живой ли это аккаунт. Формат — как в топе
 * аккаунтов: «105 878,2».
 */

import { formatTopReputation } from '@/pages/top-accounts-page/top-format'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'

/** Число для подписи или null, если нода репутацию не прислала. */
export function searchUserReputation(user: Pick<SearchUserResult, 'reputation'>): string | null {
  const raw = user.reputation as unknown
  if (raw === undefined || raw === null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? formatTopReputation(value) : null
}
