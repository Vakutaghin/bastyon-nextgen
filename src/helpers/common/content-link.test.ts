import { describe, expect, it } from 'vitest'
import { classifyContentLink } from './content-link'
import { isExternallyOpenable } from './open-external'

const TXID = 'a'.repeat(64)
const web = { isTauri: false, origin: 'https://bastyon.com' }
const desktop = { isTauri: true, origin: 'tauri://localhost' }

describe('classifyContentLink — меншены', () => {
  it('ведёт в router по внутреннему пути', () => {
    expect(classifyContentLink('/alice', { ...web, className: 'mention-link' })).toEqual({
      kind: 'router',
      path: '/alice',
    })
  })

  it('меншен с внешним href не уводит из приложения', () => {
    expect(
      classifyContentLink('https://evil.example/x', { ...web, className: 'mention-link' })
    ).toEqual({ kind: 'none' })
  })
})

// N15: ссылки рендерились как внутренние, но клик никто не обрабатывал.
describe('classifyContentLink — bastyon://', () => {
  it('пост открывается маршрутом /post/:txid', () => {
    expect(classifyContentLink(`bastyon://post?s=${TXID}`, web)).toEqual({
      kind: 'router',
      path: `/post/${TXID}`,
    })
  })

  it('комментарий доезжает параметром commentid', () => {
    const href = `bastyon://post?s=${TXID}&c=${'b'.repeat(64)}`
    expect(classifyContentLink(href, web)).toEqual({
      kind: 'router',
      path: `/post/${TXID}?commentid=${'b'.repeat(64)}`,
    })
  })

  it('видео-ссылка (index?v=) тоже открывает пост', () => {
    expect(classifyContentLink(`bastyon://index?v=${TXID}`, web).kind).toBe('router')
  })

  it('битая ссылка ведёт на главную, а не в неизвестную схему', () => {
    expect(classifyContentLink('bastyon://post?s=nope', web)).toEqual({ kind: 'router', path: '/' })
  })
})

// V40: в десктопной сборке target="_blank" не работает, ссылку открывает opener.
describe('classifyContentLink — внешние ссылки', () => {
  it('в вебе не перехватываются', () => {
    expect(classifyContentLink('https://example.com/a', web)).toEqual({ kind: 'none' })
  })

  it('в Tauri уходят наружу', () => {
    expect(classifyContentLink('https://example.com/a', desktop)).toEqual({
      kind: 'external',
      href: 'https://example.com/a',
    })
  })

  it('mailto тоже уходит наружу', () => {
    expect(classifyContentLink('mailto:a@b.c', desktop).kind).toBe('external')
  })

  it('ссылка на само приложение остаётся внутренней', () => {
    expect(classifyContentLink('https://bastyon.com/alice', web)).toEqual({ kind: 'none' })
    expect(classifyContentLink('/settings', web)).toEqual({ kind: 'none' })
  })

  it('ipfs:// оставляем просмотрщику', () => {
    expect(classifyContentLink('ipfs://bafy...', desktop)).toEqual({ kind: 'none' })
  })

  it('пустой href — ничего', () => {
    expect(classifyContentLink('', desktop)).toEqual({ kind: 'none' })
  })
})

describe('isExternallyOpenable', () => {
  it('пропускает http/https/mailto и www-сокращение', () => {
    expect(isExternallyOpenable('https://example.com')).toBe(true)
    expect(isExternallyOpenable('http://example.com')).toBe(true)
    expect(isExternallyOpenable('mailto:a@b.c')).toBe(true)
    expect(isExternallyOpenable('www.example.com')).toBe(true)
  })

  it('не пропускает javascript/data/file', () => {
    expect(isExternallyOpenable('javascript:alert(1)')).toBe(false)
    expect(isExternallyOpenable('data:text/html,<b>x</b>')).toBe(false)
    expect(isExternallyOpenable('file:///etc/passwd')).toBe(false)
    expect(isExternallyOpenable('   ')).toBe(false)
  })
})
