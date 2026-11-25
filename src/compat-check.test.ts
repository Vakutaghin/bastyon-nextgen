// Экран «Приложение не запустилось» (public/compat-check.js): на языке,
// выбранном в приложении, иначе — системы; на всех языках приложения. Обычный
// скрипт на ES5, поэтому выполняется текстом.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUPPORTED_LOCALES } from '@/i18n'

const CODE = readFileSync(join(process.cwd(), 'public/compat-check.js'), 'utf8')

function showFor(language: string, saved: string | null, ua = 'Mozilla/5.0 (Windows NT 10.0)') {
  vi.stubGlobal('navigator', { language, userAgent: ua })
  vi.stubGlobal('localStorage', { getItem: () => saved })
  // Без модулей экран показывается сразу.
  vi.spyOn(document, 'createElement').mockImplementationOnce(() => ({}) as HTMLElement)
  new Function(CODE)()
  return document.querySelector('[role="alert"]')?.textContent ?? ''
}

beforeEach(() => {
  document.body.innerHTML = ''
  delete (window as { __bastyonBooted?: boolean }).__bastyonBooted
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('экран «Приложение не запустилось»', () => {
  it('на каждом языке приложения — свой, с подсказкой для системы', () => {
    const seen = new Set<string>()
    for (const locale of SUPPORTED_LOCALES) {
      document.body.innerHTML = ''
      const text = showFor('en-US', locale)
      expect(text, locale).toMatch(/WebView2/)
      seen.add(text)
    }
    expect(seen.size).toBe(SUPPORTED_LOCALES.length)
  })

  it('язык не выбирали — по языку системы; незнакомый — английский', () => {
    for (const [language, sample] of [
      ['de-AT', 'Die App konnte nicht starten'],
      ['ko-KR', '앱을 시작할 수 없습니다'],
      ['uk-UA', 'Приложение не запустилось'],
      ['pt-BR', 'The app could not start'],
      ['', 'The app could not start'],
    ] as const) {
      document.body.innerHTML = ''
      expect(showFor(language, null), language).toContain(sample)
    }
  })

  it('подсказка — по системе: телефоны, macOS, остальное', () => {
    for (const [ua, sample] of [
      ['iPhone; CPU iPhone OS 14_0', 'Обновление ПО'],
      ['Linux; Android 8.1', 'Android System WebView'],
      ['Macintosh; Intel Mac OS X 10_15', 'Safari 15.6'],
      ['X11; Linux x86_64', 'WebKitGTK'],
    ] as const) {
      document.body.innerHTML = ''
      expect(showFor('ru-RU', null, ua), ua).toContain(sample)
    }
  })

  it('приложение запустилось — экрана нет', () => {
    ;(window as { __bastyonBooted?: boolean }).__bastyonBooted = true
    expect(showFor('ru-RU', null)).toBe('')
  })
})
