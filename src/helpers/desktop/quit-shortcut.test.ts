// Ctrl+Q выходит из приложения на Windows и Linux; на macOS выход — Cmd+Q
// системного меню, его здесь не перехватываем.

import { describe, expect, it } from 'vitest'

import { isQuitShortcut } from './quit-shortcut'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('isQuitShortcut', () => {
  it('Ctrl+Q — выход, в том числе в русской раскладке (Ctrl+Й)', () => {
    expect(isQuitShortcut(key({ ctrlKey: true, code: 'KeyQ', key: 'q' }), false)).toBe(true)
    expect(isQuitShortcut(key({ ctrlKey: true, code: 'KeyQ', key: 'й' }), false)).toBe(true)
  })

  it('другие сочетания, автоповтор и macOS — не выход', () => {
    expect(isQuitShortcut(key({ code: 'KeyQ', key: 'q' }), false)).toBe(false)
    expect(isQuitShortcut(key({ ctrlKey: true, shiftKey: true, code: 'KeyQ' }), false)).toBe(false)
    expect(isQuitShortcut(key({ ctrlKey: true, altKey: true, code: 'KeyQ' }), false)).toBe(false)
    expect(isQuitShortcut(key({ ctrlKey: true, code: 'KeyW', key: 'w' }), false)).toBe(false)
    expect(isQuitShortcut(key({ ctrlKey: true, code: 'KeyQ', repeat: true }), false)).toBe(false)
    expect(isQuitShortcut(key({ ctrlKey: true, code: 'KeyQ', key: 'q' }), true)).toBe(false)
  })
})
