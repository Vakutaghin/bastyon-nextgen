// Медиа-политика под Tor (V21, вариант B): meta-CSP запрещает картинки и
// фреймы мимо Tor; применяется один раз.

import { describe, expect, it } from 'vitest'

import {
  TOR_MEDIA_CLASS,
  TOR_MEDIA_CSP,
  TOR_MEDIA_META_ID,
  applyTorMediaPolicy,
  isTorMediaPolicyApplied,
} from './tor-media-policy'

function freshDocument(): Document {
  return document.implementation.createHTMLDocument('t')
}

describe('applyTorMediaPolicy', () => {
  it('вставляет meta CSP в head и класс на html', () => {
    const doc = freshDocument()
    expect(isTorMediaPolicyApplied(doc)).toBe(false)
    applyTorMediaPolicy(doc)
    const meta = doc.getElementById(TOR_MEDIA_META_ID) as HTMLMetaElement | null
    expect(meta?.httpEquiv).toBe('Content-Security-Policy')
    expect(meta?.content).toBe(TOR_MEDIA_CSP)
    expect(doc.documentElement.classList.contains(TOR_MEDIA_CLASS)).toBe(true)
    expect(isTorMediaPolicyApplied(doc)).toBe(true)
  })

  it('идемпотентна', () => {
    const doc = freshDocument()
    applyTorMediaPolicy(doc)
    applyTorMediaPolicy(doc)
    expect(doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')).toHaveLength(1)
  })

  it('политика: картинки только self/data/blob/asset, фреймы только self', () => {
    expect(TOR_MEDIA_CSP).toMatch(/img-src 'self' data: blob: asset:/)
    expect(TOR_MEDIA_CSP).toMatch(/frame-src 'self'/)
    // https: в img-src означало бы прямую загрузку мимо Tor.
    expect(TOR_MEDIA_CSP).not.toMatch(/img-src[^;]*\shttps:(\s|;|$)/)
  })
})
