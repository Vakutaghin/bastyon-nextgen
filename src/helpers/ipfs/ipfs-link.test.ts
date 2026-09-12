import { describe, it, expect } from 'vitest'
import { parseIpfsLink, parseIpfsSecret } from './ipfs-link'
import { buildIpfsViewerUrl, buildIpfsShareLink, buildIpfsSecretLink } from './ipfs-viewer'

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

  it('subdomain-форма <cid>.ipfs.dweb.link', () => {
    expect(
      parseIpfsLink(
        'https://bafybeia3mpj3u3ljhaultrortqwy3nfnqwdzthi2bly6qkp4pimeol6d3m.ipfs.dweb.link/'
      )
    ).toEqual({
      namespace: 'ipfs',
      root: 'bafybeia3mpj3u3ljhaultrortqwy3nfnqwdzthi2bly6qkp4pimeol6d3m',
      path: '',
    })
  })

  it('subdomain-форма <name>.ipns.dweb.link с путём', () => {
    expect(
      parseIpfsLink(
        'https://k51qzi5uqu5dkj3ptoum9xmmmbxmny5zhbkavmgvufjmitt3zawcxva1zyqi3k.ipns.dweb.link/blog/post.html'
      )
    ).toEqual({
      namespace: 'ipns',
      root: 'k51qzi5uqu5dkj3ptoum9xmmmbxmny5zhbkavmgvufjmitt3zawcxva1zyqi3k',
      path: 'blog/post.html',
    })
  })

  it('path-форма на ipfs.io/ipns/<name> (host сам содержит "ipfs")', () => {
    expect(parseIpfsLink('https://ipfs.io/ipns/k51qzi5uqu5dkj3ptoum/')).toEqual({
      namespace: 'ipns',
      root: 'k51qzi5uqu5dkj3ptoum',
      path: '',
    })
  })

  it('path-форма важнее хоста: gateway.ipfs.io/ipfs/<cid> не ломается меткой "ipfs"', () => {
    expect(
      parseIpfsLink(
        'https://gateway.ipfs.io/ipfs/bafybeia3mpj3u3ljhaultrortqwy3nfnqwdzthi2bly6qkp4pimeol6d3m/x'
      )
    ).toEqual({
      namespace: 'ipfs',
      root: 'bafybeia3mpj3u3ljhaultrortqwy3nfnqwdzthi2bly6qkp4pimeol6d3m',
      path: 'x',
    })
  })

  it('обычные сайты с меткой ipfs/ipns в хосте НЕ перехватываем', () => {
    expect(parseIpfsLink('https://docs.ipfs.tech/concepts/')).toBeNull()
    expect(parseIpfsLink('https://www.ipfs.io/')).toBeNull()
    expect(parseIpfsLink('https://blog.ipfs.tech/2024/post')).toBeNull()
    expect(parseIpfsLink('https://x.ipfs.attacker.com/')).toBeNull()
  })

  it('subdomain IPNS: инлайн-DNSLink раз-инлайнивается', () => {
    expect(parseIpfsLink('https://en-wikipedia--on--ipfs-org.ipns.dweb.link/wiki/')).toEqual({
      namespace: 'ipns',
      root: 'en.wikipedia-on-ipfs.org',
      path: 'wiki',
    })
  })

  it('обычные http(s)-ссылки → null (не трогаем)', () => {
    expect(parseIpfsLink('https://example.com/page')).toBeNull()
    expect(parseIpfsLink('https://bastyon.com/post/abc')).toBeNull()
  })

  it('внутренние роут-пути (не /ipfs, /ipns) → null', () => {
    expect(parseIpfsLink('/post/123')).toBeNull()
    expect(parseIpfsLink('/profile/me')).toBeNull()
  })

  it('точечные сегменты не выводят URL за /ipfs/<root> (D1)', () => {
    expect(parseIpfsLink('ipfs://../api/v0/id')).toBeNull()
    expect(parseIpfsLink('ipfs://%2e%2e/x')).toBeNull()
    expect(parseIpfsLink('/ipfs/..')).toBeNull()
    expect(parseIpfsLink('ipfs://bafyCID/../../api/v0/id')?.path).toBe('api/v0/id')
    expect(parseIpfsLink('ipfs://bafyCID/a/%2e%2e/b')?.path).toBe('a/b')
    expect(parseIpfsLink('ipfs://bafyCID/./x//y/')?.path).toBe('x/y')
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

describe('buildIpfsShareLink', () => {
  it('собирает ipfs://<cid> и round-trip через parseIpfsLink', () => {
    const link = buildIpfsShareLink('bafyCID')
    expect(link).toBe('ipfs://bafyCID')
    expect(parseIpfsLink(link)).toEqual({ namespace: 'ipfs', root: 'bafyCID', path: '' })
  })

  it('тримит пробелы CID', () => {
    expect(buildIpfsShareLink('  bafyCID\n')).toBe('ipfs://bafyCID')
  })
})

describe('IPFS secret links (private sharing)', () => {
  it('round-trip ключа (с +/=) и имени файла', () => {
    const key = 'aB+/cd=='
    const link = buildIpfsSecretLink('bafyCID', key, 'my photo.png')
    expect(parseIpfsSecret(link)).toEqual({ key, name: 'my photo.png' })
    // Базовый target по-прежнему парсится (фрагмент отброшен).
    expect(parseIpfsLink(link)).toEqual({ namespace: 'ipfs', root: 'bafyCID', path: '' })
  })

  it('нет фрагмента / нет key → null', () => {
    expect(parseIpfsSecret('ipfs://bafyCID')).toBeNull()
    expect(parseIpfsSecret('ipfs://bafyCID#name=x')).toBeNull()
    expect(parseIpfsSecret('https://example.com/page')).toBeNull()
  })
})
