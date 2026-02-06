/**
 * Создание и отправка userInfo действия для регистрации пользователя
 */

import type { KeyPair } from '../types/keys'
import type { Address } from '../types/addresses'

export interface UserInfoData {
  name: string
  about?: string
  site?: string
  language?: string
  image?: string
  addresses?: string[]
  ref?: string
  keys?: string[]
  email?: string
}

/**
 * Сериализует userInfo данные в строку (как в старом приложении)
 */
export function serializeUserInfo(userInfo: UserInfoData): string {
  const name = userInfo.name || ''
  const site = userInfo.site || ''
  const language = userInfo.language || ''
  const about = userInfo.about || ''
  const image = userInfo.image || ''
  const addresses = JSON.stringify(userInfo.addresses || [])
  const ref = userInfo.ref || ''
  const keys = (userInfo.keys || []).join(',')

  return name + site + language + about + image + addresses + ref + keys
}

/**
 * Экспортирует userInfo данные в формат для транзакции
 */
export function exportUserInfo(userInfo: UserInfoData, extended: boolean = false): Record<string, unknown> {
  if (extended) {
    return {
      type: 'userInfo',
      name: userInfo.name,
      about: userInfo.about || '',
      site: userInfo.site || '',
      language: userInfo.language || '',
      image: userInfo.image || '',
      addresses: JSON.stringify(userInfo.addresses || []),
      ref: userInfo.ref || '',
      keys: (userInfo.keys || []).join(','),
    }
  }

  return {
    n: userInfo.name,
    a: userInfo.about || '',
    s: userInfo.site || '',
    l: userInfo.language || '',
    i: userInfo.image || '',
    b: JSON.stringify(userInfo.addresses || []),
    r: userInfo.ref || '',
    k: (userInfo.keys || []).join(','),
  }
}
