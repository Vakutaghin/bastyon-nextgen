/**
 * Ник или адрес Bastyon → адрес: для ручного списка фильтра входящих.
 * Ник ищет нода (`getuseraddress`, без учёта регистра); адрес с верной
 * контрольной суммой берётся как есть.
 */

import { isValidAddress } from '@/blockchain/core/addresses/address-validator'
import type { UserAddressData } from '@/types/rpc-responses/get-user-address'

/** Адрес или `null` — такого ника нет. Сеть недоступна — бросает, решает вызывающий. */
export async function resolvePerson(input: string): Promise<string | null> {
  const value = input.trim().replace(/^@/, '')
  if (!value) return null
  if (/^P\w{25,40}$/.test(value) && isValidAddress(value)) return value
  const { rpcCallArray } = await import('@/helpers/api/request')
  const users = await rpcCallArray<UserAddressData>({
    method: 'getuseraddress',
    parameters: [value],
    options: { auth: false },
  })
  return users[0]?.address ?? null
}
