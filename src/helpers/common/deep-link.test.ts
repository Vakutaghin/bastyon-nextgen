import { describe, expect, it } from 'vitest'
import { resolveDeepLink } from './deep-link'

const TXID = 'a'.repeat(64)
const COMMENT = 'b'.repeat(64)

describe('resolveDeepLink — посты', () => {
  it('bastyon://post?s=<txid>', () => {
    expect(resolveDeepLink(`bastyon://post?s=${TXID}`)).toBe(`/post/${TXID}`)
  })

  it('комментарий доезжает параметром', () => {
    expect(resolveDeepLink(`bastyon://post?s=${TXID}&c=${COMMENT}`)).toBe(
      `/post/${TXID}?commentid=${COMMENT}`
    )
  })

  it('видео-ссылка index?v=', () => {
    expect(resolveDeepLink(`bastyon://index?v=${TXID}`)).toBe(`/post/${TXID}`)
  })

  it('битый txid ведёт в ленту, а не на страницу мусорного поста', () => {
    expect(resolveDeepLink('bastyon://post?s=not-a-txid')).toBe('/')
  })

  it('https-ссылка на bastyon.com разбирается так же', () => {
    expect(resolveDeepLink(`https://bastyon.com/post?s=${TXID}`)).toBe(`/post/${TXID}`)
  })
})

describe('resolveDeepLink — профили', () => {
  it('bastyon://<ник>', () => {
    expect(resolveDeepLink('bastyon://alice')).toBe('/alice')
  })

  it('profile?address=', () => {
    expect(resolveDeepLink('bastyon://profile?address=PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82')).toBe(
      '/PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
    )
  })

  it('pocketnet:// — историческая схема, тоже наша', () => {
    expect(resolveDeepLink('pocketnet://bob')).toBe('/bob')
  })

  it('web+bastyon:// — форма для PWA', () => {
    expect(resolveDeepLink('web+bastyon://bob')).toBe('/bob')
  })
})

describe('resolveDeepLink — мини-приложения', () => {
  it('application?id=', () => {
    expect(resolveDeepLink('bastyon://application?id=barteron.pocketnet.app')).toBe(
      '/app/barteron.pocketnet.app'
    )
  })

  it('вложенный путь приходит hex-кодированным (legacy)', () => {
    // hex('offers/42')
    const hex = Buffer.from('offers/42', 'utf8').toString('hex')
    expect(resolveDeepLink(`bastyon://application?id=demo.app&p=${hex}`)).toBe(
      '/app/demo.app/offers/42'
    )
  })

  it('битый hex не ломает переход', () => {
    expect(resolveDeepLink('bastyon://application?id=demo.app&p=zz')).toBe('/app/demo.app')
  })
})

describe('resolveDeepLink — разделы и мусор', () => {
  it('известный раздел отдаётся как есть', () => {
    expect(resolveDeepLink('bastyon://search?q=test')).toBe('/search?q=test')
    expect(resolveDeepLink('bastyon://wallets')).toBe('/wallets')
  })

  it('голая схема открывает главную', () => {
    expect(resolveDeepLink('bastyon://')).toBe('/')
  })

  it('чужая ссылка не наша забота', () => {
    expect(resolveDeepLink('https://example.com/post')).toBeNull()
    expect(resolveDeepLink('javascript:alert(1)')).toBeNull()
    expect(resolveDeepLink('')).toBeNull()
  })

  it('ник с недопустимыми символами отклоняется', () => {
    expect(resolveDeepLink('bastyon://a/b/c')).toBeNull()
  })
})
