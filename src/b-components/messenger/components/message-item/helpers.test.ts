import { describe, it, expect } from 'vitest'
import { formatMessageSegments, formatMessageText, extractFirstExternalUrl } from './helpers'

const TXID = 'a'.repeat(64)
const TXID2 = 'f'.repeat(64)

describe('formatMessageText', () => {
  it('escapes HTML in plain text', () => {
    expect(formatMessageText('hello <b>world</b>')).toBe('hello &lt;b&gt;world&lt;/b&gt;')
  })

  it('wraps https URL in <a>', () => {
    const html = formatMessageText('see https://example.com end')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('end')
  })
})

describe('formatMessageSegments', () => {
  it('returns one html segment when no bastyon link present', () => {
    const segs = formatMessageSegments('hello world https://google.com')
    expect(segs).toHaveLength(1)
    expect(segs[0]!.kind).toBe('html')
  })

  it('returns empty array for empty text', () => {
    expect(formatMessageSegments('')).toEqual([])
  })

  it('extracts a single bastyon embed surrounded by text', () => {
    const text = `Check this bastyon://post?s=${TXID} please`
    const segs = formatMessageSegments(text)
    expect(segs).toHaveLength(3)
    expect(segs[0]).toEqual({ kind: 'html', html: 'Check this ' })
    expect(segs[1]?.kind).toBe('bastyon')
    if (segs[1]?.kind === 'bastyon') {
      expect(segs[1].target.txid).toBe(TXID)
      expect(segs[1].target.isVideo).toBe(false)
    }
    expect(segs[2]).toEqual({ kind: 'html', html: ' please' })
  })

  it('extracts an https bastyon.com link', () => {
    const text = `https://bastyon.com/post?s=${TXID}`
    const segs = formatMessageSegments(text)
    expect(segs).toHaveLength(1)
    expect(segs[0]?.kind).toBe('bastyon')
  })

  it('detects video target via index path', () => {
    const text = `Watch https://bastyon.com/index?v=${TXID}`
    const segs = formatMessageSegments(text)
    expect(segs[1]?.kind).toBe('bastyon')
    if (segs[1]?.kind === 'bastyon') {
      expect(segs[1].target.isVideo).toBe(true)
    }
  })

  it('handles multiple bastyon links in one message', () => {
    const text = `one bastyon://post?s=${TXID} two bastyon://post?s=${TXID2} three`
    const segs = formatMessageSegments(text)
    const bastyon = segs.filter((s) => s.kind === 'bastyon')
    expect(bastyon).toHaveLength(2)
    expect(segs.map((s) => s.kind)).toEqual(['html', 'bastyon', 'html', 'bastyon', 'html'])
  })

  it('extracts comment target', () => {
    const COMMENT = 'b'.repeat(64)
    const text = `bastyon://post?s=${TXID}&c=${COMMENT}`
    const segs = formatMessageSegments(text)
    expect(segs[0]?.kind).toBe('bastyon')
    if (segs[0]?.kind === 'bastyon') {
      expect(segs[0].target.commentId).toBe(COMMENT)
    }
  })

  it('non-bastyon links still get linkified inside html segments', () => {
    const text = `Mix bastyon://post?s=${TXID} with https://google.com`
    const segs = formatMessageSegments(text)
    expect(segs).toHaveLength(3)
    expect(segs[2]?.kind).toBe('html')
    if (segs[2]?.kind === 'html') {
      expect(segs[2].html).toContain('<a href="https://google.com"')
    }
  })
})

describe('extractFirstExternalUrl', () => {
  it('returns null when no URL present', () => {
    expect(extractFirstExternalUrl('hello world')).toBeNull()
    expect(extractFirstExternalUrl('')).toBeNull()
  })

  it('extracts the first http(s) URL', () => {
    expect(extractFirstExternalUrl('go to https://example.com please')).toBe('https://example.com')
  })

  it('skips Bastyon links', () => {
    expect(extractFirstExternalUrl(`see bastyon://post?s=${TXID}`)).toBeNull()
  })

  it('skips bastyon.com/post hosts', () => {
    expect(extractFirstExternalUrl(`https://bastyon.com/post?s=${TXID}`)).toBeNull()
  })

  it('finds non-bastyon URL when bastyon link is also present', () => {
    const r = extractFirstExternalUrl(`Open https://wiki.org first, then bastyon://post?s=${TXID}`)
    expect(r).toBe('https://wiki.org')
  })

  it('strips trailing punctuation', () => {
    expect(extractFirstExternalUrl('check https://example.com.')).toBe('https://example.com')
    expect(extractFirstExternalUrl('what about https://example.com?')).toBe('https://example.com')
  })

  it('rejects unsafe protocols', () => {
    expect(extractFirstExternalUrl('javascript:alert(1)')).toBeNull()
    // MESSAGE_URL_PATTERN ловит ftp:// — но isSafeHttpUrl его отсекает
    expect(extractFirstExternalUrl('ftp://example.com')).toBeNull()
  })
})
