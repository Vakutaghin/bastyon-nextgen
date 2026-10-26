// Кому принадлежит имя: проверка «имя занято» при регистрации и смене имени.

import type { UserAddressData } from '@/types/rpc-responses/get-user-address'

/**
 * Имя занято другим адресом? Прокси отвечает конвертом `{ result, data: [...] }`
 * (раньше здесь ждали голый массив, и занятое имя не ловилось никогда); нода
 * ищет без учёта регистра. Сеть недоступна — бросает, решает вызывающий.
 */
export async function isNicknameTaken(name: string, myAddress?: string | null): Promise<boolean> {
  const { rpcCallArray } = await import('@/helpers/api/request')
  const users = await rpcCallArray<UserAddressData>({
    method: 'getuseraddress',
    parameters: [name],
    options: { auth: false },
  })
  const owner = users[0]?.address
  return !!owner && owner !== myAddress
}
