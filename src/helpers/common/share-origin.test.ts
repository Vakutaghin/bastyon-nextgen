// S20: ссылка, которой делятся, не должна вести на origin локальной оболочки
// (`tauri://localhost`, `https://localhost` в Capacitor).

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  commentUrl,
  HELP_SOURCE_URL,
  publicEmbedCode,
  publicHelpUrl,
  publicShareOrigin,
  publicPostUrl,
  PUBLIC_WEB_ORIGIN,
} from './share-origin'

function setOrigin(origin: string): void {
  vi.stubGlobal('window', { location: { origin } } as unknown as Window)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('publicShareOrigin (S20)', () => {
  it('keeps a real web origin as is', () => {
    setOrigin('https://bastyon.com')
    expect(publicShareOrigin()).toBe('https://bastyon.com')
  })

  it('replaces the Tauri shell origin with the public web address', () => {
    setOrigin('tauri://localhost')
    expect(publicShareOrigin()).toBe(PUBLIC_WEB_ORIGIN)
  })

  it('replaces the Capacitor localhost origin', () => {
    vi.stubEnv('DEV', false)
    setOrigin('https://localhost')
    expect(publicShareOrigin()).toBe(PUBLIC_WEB_ORIGIN)
  })

  it('builds a post link the web client on bastyon.com opens (post?s=)', () => {
    setOrigin('tauri://localhost')
    expect(publicPostUrl('abc123')).toBe(`${PUBLIC_WEB_ORIGIN}/post?s=abc123`)
  })

  it('keeps /post/:txid on a web build of this app', () => {
    setOrigin('https://next.example')
    expect(publicPostUrl('abc123')).toBe('https://next.example/post/abc123')
  })
})

describe('commentUrl', () => {
  it('on bastyon.com: post?s= with commentid and, for a reply, parentid', () => {
    expect(commentUrl(PUBLIC_WEB_ORIGIN, 'P', { id: 'c2', parentid: 'c1' })).toBe(
      `${PUBLIC_WEB_ORIGIN}/post?s=P&commentid=c2&parentid=c1`
    )
    expect(commentUrl(PUBLIC_WEB_ORIGIN, 'P', { id: 'c1', parentid: '' })).toBe(
      `${PUBLIC_WEB_ORIGIN}/post?s=P&commentid=c1`
    )
  })

  it('on another origin: /post/:txid?commentid=', () => {
    expect(commentUrl('https://o', 'P', { id: 'c2', parentid: 'c1' })).toBe(
      'https://o/post/P?commentid=c2&parentid=c1'
    )
  })
})

describe('publicEmbedCode', () => {
  it('for bastyon.com gives the widget of the web client there', () => {
    setOrigin('tauri://localhost')
    const code = publicEmbedCode('abc123')
    const seed = /id="pocketnet_(\d{5})"/.exec(code)?.[1]
    expect(seed).toBeDefined()
    expect(code).toContain(`<script src="${PUBLIC_WEB_ORIGIN}/js/widgets.js"></script>`)
    // {"black":false,"comments":""} в hex-кодировке прежнего клиента
    const params = Buffer.from('{"black":false,"comments":""}', 'latin1').toString('hex')
    expect(code).toContain(`(new window.PNWIDGETS()).make(${seed}, "lenta", "abc123", "${params}")`)
  })

  it('for a web build of this app gives an iframe of /embed/post', () => {
    setOrigin('https://next.example')
    expect(publicEmbedCode('abc123')).toContain(
      '<iframe src="https://next.example/embed/post/abc123"'
    )
  })
})

describe('publicHelpUrl', () => {
  it('from the desktop and phone leads to the article in the repository', () => {
    setOrigin('tauri://localhost')
    expect(HELP_SOURCE_URL).toBe('https://github.com/Vakutaghin/bastyon-nextgen/blob/main/help')
    expect(publicHelpUrl('ru', 'limits')).toBe(`${HELP_SOURCE_URL}/ru/limits.md`)
    expect(publicHelpUrl('en', null)).toBe(`${HELP_SOURCE_URL}/en/README.md`)
  })

  it('a web build of this app opens its own /help', () => {
    setOrigin('https://next.example')
    expect(publicHelpUrl('ru', 'limits')).toBe('https://next.example/help/limits')
    expect(publicHelpUrl('ru', null)).toBe('https://next.example/help')
  })
})
