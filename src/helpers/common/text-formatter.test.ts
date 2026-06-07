import { describe, it, expect } from 'vitest'
import { formatBastyonLinks } from './text-formatter'

describe('formatBastyonLinks', () => {
  it('returns empty string for falsy input', () => {
    expect(formatBastyonLinks('')).toBe('')
    expect(formatBastyonLinks(null as any)).toBe('')
    expect(formatBastyonLinks(undefined as any)).toBe('')
  })

  it('escapes plain text without links', () => {
    expect(formatBastyonLinks('hello <world>')).toBe('hello &lt;world&gt;')
  })

  it('converts bastyon:// links', () => {
    const result = formatBastyonLinks('see bastyon://profile/user1 here')
    expect(result).toContain("class='bastyon-link'")
    expect(result).toContain("href='bastyon://profile/user1'")
    expect(result).not.toContain("target='_blank'")
  })

  it('converts https:// links with target=_blank', () => {
    const result = formatBastyonLinks('visit https://example.com now')
    expect(result).toContain("href='https://example.com'")
    expect(result).toContain("target='_blank'")
    expect(result).toContain("rel='noopener noreferrer'")
  })

  it('converts www. links with https prefix', () => {
    const result = formatBastyonLinks('go to www.example.com please')
    expect(result).toContain("href='https://www.example.com'")
    expect(result).toContain("target='_blank'")
  })

  it('handles multiple links in text', () => {
    const result = formatBastyonLinks('a https://one.com b https://two.com c')
    expect(result).toContain('https://one.com')
    expect(result).toContain('https://two.com')
  })

  it('escapes surrounding text', () => {
    const result = formatBastyonLinks('<b>bold</b> https://x.com')
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('linkifies @mentions to profile route', () => {
    const result = formatBastyonLinks('hi @alice!')
    expect(result).toContain("href='/alice'")
    expect(result).toContain("class='mention-link'")
    expect(result).toContain('@alice')
  })

  it('detects a mention at the start of text', () => {
    expect(formatBastyonLinks('@bob hello')).toContain("href='/bob'")
  })

  it('does not treat an email as a mention', () => {
    const result = formatBastyonLinks('mail me at user@example')
    expect(result).not.toContain('mention-link')
  })

  it('does not mention-link inside a URL', () => {
    const result = formatBastyonLinks('https://example.com/@handle')
    expect(result).not.toContain('mention-link')
    expect(result).toContain("href='https://example.com/@handle'")
  })

  it('handles a mention next to a link', () => {
    const result = formatBastyonLinks('@alice see https://x.com')
    expect(result).toContain("href='/alice'")
    expect(result).toContain("href='https://x.com'")
  })
})
