import { describe, it, expect } from 'vitest'
import { escapeHtml, unescapeHtml } from './html-escape'

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("'hello'")).toBe("&#039;hello&#039;")
  })

  it('escapes all special chars together', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('unescapeHtml', () => {
  it('unescapes ampersand', () => {
    expect(unescapeHtml('a &amp; b')).toBe('a & b')
  })

  it('unescapes angle brackets', () => {
    expect(unescapeHtml('&lt;script&gt;')).toBe('<script>')
  })

  it('unescapes quotes', () => {
    expect(unescapeHtml('&quot;hello&quot;')).toBe('"hello"')
    expect(unescapeHtml('&#039;hello&#039;')).toBe("'hello'")
  })

  it('is inverse of escapeHtml', () => {
    const original = '<a href="test">&\'foo\''
    expect(unescapeHtml(escapeHtml(original))).toBe(original)
  })

  it('handles empty string', () => {
    expect(unescapeHtml('')).toBe('')
  })
})
