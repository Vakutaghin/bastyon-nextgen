import { describe, expect, it } from 'vitest'

import { chatLinks } from '@/helpers/common/share-origin'
import { parseEntityLink } from './entity-link'

const ADDRESS = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const TX = 'C'.repeat(64)

describe('ссылка на профиль или коллекцию', () => {
  it('то, что шлёт «Отправить в чат», и схема приложения', () => {
    expect(parseEntityLink(chatLinks.profile(ADDRESS))).toEqual({
      kind: 'profile',
      address: ADDRESS,
    })
    expect(parseEntityLink(chatLinks.collection(TX))).toEqual({
      kind: 'collection',
      txid: TX.toLowerCase(),
    })
    expect(parseEntityLink(`bastyon://author?address=${ADDRESS}`)?.kind).toBe('profile')
    expect(parseEntityLink(`https://pocketnet.app/collection?c=${TX}`)?.kind).toBe('collection')
  })

  it('чужой сайт, битый адрес, лишние параметры — не она', () => {
    expect(parseEntityLink(`https://evil.com/author?address=${ADDRESS}`)).toBeNull()
    expect(parseEntityLink('https://bastyon.com/author?address=Xnotanaddress')).toBeNull()
    expect(parseEntityLink(`https://bastyon.com/collection?c=${TX}&x=1`)).toBeNull()
    expect(parseEntityLink(`https://bastyon.com/collection?c=${TX.slice(1)}`)).toBeNull()
  })
})
