import { describe, it, expect } from 'vitest'

import { safeHttpImageUrl } from './safe-image-url'

describe('safeHttpImageUrl (V16)', () => {
  it('голый хеш → полный https-URL, http(s) — как есть', () => {
    expect(safeHttpImageUrl('abc123')).toBe('https://pocketnet.app:8092/i/abc123')
    expect(safeHttpImageUrl('https://x.test/cover.jpg')).toBe('https://x.test/cover.jpg')
  })
  it('CSS-инъекция превращается в обычный (перекодированный) href', () => {
    const evil = 'https://x.test/a") } body { display:none } .x { background: url("https://evil/px'
    const out = safeHttpImageUrl(evil)!
    expect(out.startsWith('https://x.test/')).toBe(true)
    expect(out).not.toContain('"')
    expect(out).not.toContain('} body')
  })
  it('не-http схемы и мусор → null', () => {
    expect(safeHttpImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpImageUrl('data:image/png;base64,AAAA')).toBeNull()
    expect(safeHttpImageUrl('')).toBeNull()
    expect(safeHttpImageUrl(null)).toBeNull()
  })
})
