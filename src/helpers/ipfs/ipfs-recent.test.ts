// Недавние адреса IPFS-браузера: свежие сверху, без повторов, не больше
// MAX_RECENT; хранилище недоступно — не падаем.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_RECENT, forgetRecent, ipfsAddress, loadRecent, rememberRecent } from './ipfs-recent'

describe('ipfs-recent', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('адрес как в адресной строке', () => {
    expect(ipfsAddress({ namespace: 'ipfs', root: 'bafyX', path: 'wiki/Cat.jpg' })).toBe(
      'ipfs://bafyX/wiki/Cat.jpg'
    )
    expect(ipfsAddress({ namespace: 'ipns', root: 'k51X', path: '' })).toBe('ipns://k51X')
  })

  it('свежие сверху, без повторов, не больше MAX_RECENT', () => {
    rememberRecent('ipfs://a')
    rememberRecent('ipfs://b')
    expect(rememberRecent('ipfs://a')).toEqual(['ipfs://a', 'ipfs://b'])
    for (let i = 0; i < MAX_RECENT + 3; i++) rememberRecent(`ipfs://n${i}`)
    expect(loadRecent()).toHaveLength(MAX_RECENT)
    expect(loadRecent()[0]).toBe(`ipfs://n${MAX_RECENT + 2}`)
    expect(forgetRecent(`ipfs://n${MAX_RECENT + 2}`)).not.toContain(`ipfs://n${MAX_RECENT + 2}`)
  })

  it('битое или недоступное хранилище — пустой список, без ошибок', () => {
    localStorage.setItem('ipfs:recent', '{oops')
    expect(loadRecent()).toEqual([])
    localStorage.setItem('ipfs:recent', JSON.stringify(['ipfs://a', 42]))
    expect(loadRecent()).toEqual(['ipfs://a'])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(rememberRecent('ipfs://b')).toEqual(['ipfs://b', 'ipfs://a'])
  })
})
