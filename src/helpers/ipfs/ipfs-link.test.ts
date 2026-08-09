import { describe, it, expect } from 'vitest'
import { parseIpfsLink } from './ipfs-link'
import { buildIpfsViewerUrl } from './ipfs-viewer'

describe('parseIpfsLink', () => {
  it('scheme-форма ipfs:// с путём', () => {
    expect(parseIpfsLink('ipfs://bafyCID/dir/page.html')).toEqual({
      namespace: 'ipfs',
      root: 'bafyCID',
      path: 'dir/page.html',
    })
  })

  it('scheme-форма ipns:// без пути', () => {
    expect(parseIpfsLink('ipns://k51name')).toEqual({
      namespace: 'ipns',
      root: 'k51name',
      path: '',
    })
  })

  it('path-форма /ipfs/<cid>', () => {
    expect(parseIpfsLink('/ipfs/QmHash/a/b')).toEqual({
      namespace: 'ipfs',
      root: 'QmHash',
      path: 'a/b',
    })
  })

  it('gateway-URL с /ipfs/<cid>', () => {
    expect(parseIpfsLink('https://dweb.link/ipfs/bafyCID/x')).toEqual({
      namespace: 'ipfs',
      root: 'bafyCID',
      path: 'x',
    })
  })

  it('отбрасывает query и hash из пути', () => {
    expect(parseIpfsLink('ipfs://bafyCID/page?x=1#frag')?.path).toBe('page')
  })

  it('обычные http(s)-ссылки → null (не трогаем)', () => {
    expect(parseIpfsLink('https://example.com/page')).toBeNull()
    expect(parseIpfsLink('https://bastyon.com/post/abc')).toBeNull()
  })

  it('внутренние роут-пути (не /ipfs, /ipns) → null', () => {
    expect(parseIpfsLink('/post/123')).toBeNull()
    expect(parseIpfsLink('/profile/me')).toBeNull()
  })

  it('мусор → null', () => {
    expect(parseIpfsLink('')).toBeNull()
    expect(parseIpfsLink('ipfs://')).toBeNull()
    expect(parseIpfsLink('javascript:alert(1)')).toBeNull()
  })
})

describe('buildIpfsViewerUrl', () => {
  it('собирает gateway-URL с путём', () => {
    expect(
      buildIpfsViewerUrl({ namespace: 'ipfs', root: 'bafyCID', path: 'a/b' }, 'https://gw.example')
    ).toBe('https://gw.example/ipfs/bafyCID/a/b')
  })

  it('без пути — без хвостового слэша', () => {
    expect(
      buildIpfsViewerUrl({ namespace: 'ipns', root: 'k51name', path: '' }, 'https://gw.example/')
    ).toBe('https://gw.example/ipns/k51name')
  })
})
