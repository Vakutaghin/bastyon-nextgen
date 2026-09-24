import { describe, it, expect } from 'vitest'
import { formatBastyonLinks } from './text-formatter'

describe('formatBastyonLinks', () => {
  it('returns empty string for falsy input', () => {
    expect(formatBastyonLinks('')).toBe('')
    expect(formatBastyonLinks(null as any)).toBe('')
    expect(formatBastyonLinks(undefined as any)).toBe('')
  })

  it('escapes unknown/unsafe tags as text', () => {
    expect(formatBastyonLinks('hello <world>')).toBe('hello &lt;world&gt;')
  })

  it('converts ipfs:// and ipns:// share links (incl. private #key fragment)', () => {
    const r1 = formatBastyonLinks('file: ipfs://bafyabc123 ok')
    expect(r1).toContain('href="ipfs://bafyabc123"')
    expect(r1).toContain('ipfs-link')
    expect(r1).not.toContain('target=')
    const r2 = formatBastyonLinks('ipfs://bafyabc#key=aB%2B%2Fcd%3D%3D&name=a.png')
    expect(r2).toContain('href="ipfs://bafyabc#key=aB%2B%2Fcd%3D%3D&amp;name=a.png"')
    expect(formatBastyonLinks('ipns://k51name/x')).toContain('href="ipns://k51name/x"')
  })

  it('converts bastyon:// links', () => {
    const result = formatBastyonLinks('see bastyon://profile/user1 here')
    expect(result).toContain('class="bastyon-link"')
    expect(result).toContain('href="bastyon://profile/user1"')
    expect(result).not.toContain('target="_blank"')
  })

  it('converts https:// links with target=_blank', () => {
    const result = formatBastyonLinks('visit https://example.com now')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('converts www. links with https prefix', () => {
    const result = formatBastyonLinks('go to www.example.com please')
    expect(result).toContain('href="https://www.example.com"')
    expect(result).toContain('target="_blank"')
  })

  it('handles multiple links in text', () => {
    const result = formatBastyonLinks('a https://one.com b https://two.com c')
    expect(result).toContain('https://one.com')
    expect(result).toContain('https://two.com')
  })

  it('preserves safe inline HTML (bold/italic/br) and entities', () => {
    const result = formatBastyonLinks('<b>bold</b> <i>it</i>&nbsp;line<br>break https://x.com')
    expect(result).toContain('<b>bold</b>')
    expect(result).toContain('<i>it</i>')
    expect(result).toContain('<br>')
    expect(result).toContain('&nbsp;')
  })

  it('strips dangerous markup (script / event handlers / js: protocol)', () => {
    expect(formatBastyonLinks('safe<script>alert(1)</script>end')).not.toContain('alert(1)')
    const onerr = formatBastyonLinks('<img src=x onerror=alert(1)>')
    expect(onerr).not.toContain('onerror')
    const js = formatBastyonLinks("<a href='javascript:alert(1)'>x</a>")
    expect(js).not.toContain('javascript:')
  })

  it('linkifies @mentions to profile route', () => {
    const result = formatBastyonLinks('hi @alice!')
    expect(result).toContain('href="/alice"')
    expect(result).toContain('class="mention-link"')
    expect(result).toContain('@alice')
  })

  it('detects a mention at the start of text', () => {
    expect(formatBastyonLinks('@bob hello')).toContain('href="/bob"')
  })

  it('does not treat an email as a mention', () => {
    const result = formatBastyonLinks('mail me at user@example')
    expect(result).not.toContain('mention-link')
  })

  it('does not mention-link inside a URL', () => {
    const result = formatBastyonLinks('https://example.com/@handle')
    expect(result).not.toContain('mention-link')
    expect(result).toContain('href="https://example.com/@handle"')
  })

  it('handles a mention next to a link', () => {
    const result = formatBastyonLinks('@alice see https://x.com')
    expect(result).toContain('href="/alice"')
    expect(result).toContain('href="https://x.com"')
  })
})

// S24: регулярка шла по сырой строке и вставляла <a> внутрь значений
// атрибутов — инлайновые ссылки и картинки теряли href/src.
describe('formatBastyonLinks — линкификация только текстовых узлов (S24)', () => {
  it('не ломает href существующей ссылки', () => {
    const result = formatBastyonLinks('<a href="https://example.com/page">тут</a>')
    expect(result).toContain('href="https://example.com/page"')
    expect(result).not.toContain('<a href="<a')
    // Внутрь ссылки вложенная ссылка не попадает.
    expect(result.match(/<a /g)).toHaveLength(1)
  })

  it('не ломает src картинки', () => {
    const result = formatBastyonLinks('<img src="https://example.com/pic.png">')
    expect(result).toContain('src="https://example.com/pic.png"')
    expect(result).not.toContain('<a ')
  })

  it('линкифицирует текст рядом с готовой разметкой', () => {
    const result = formatBastyonLinks('<b>жирный</b> и https://example.com/next')
    expect(result).toContain('<b>жирный</b>')
    expect(result).toContain('href="https://example.com/next"')
  })

  it('не трогает ссылки внутри code/pre', () => {
    const result = formatBastyonLinks('<code>https://example.com</code>')
    expect(result).not.toContain('<a ')
    expect(result).toContain('<code>https://example.com</code>')
  })

  it('меншен внутри существующей ссылки не превращается во вложенную', () => {
    const result = formatBastyonLinks('<a href="/somewhere">@alice</a>')
    expect(result.match(/<a /g)).toHaveLength(1)
    expect(result).not.toContain('mention-link')
  })
})
