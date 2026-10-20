// Файл, брошенный мимо зон для файлов, не должен открываться вместо страницы;
// зоны и вставка текста в поле работают как раньше.

import { beforeAll, describe, expect, it } from 'vitest'
import { installDropGuard } from './drop-guard'

beforeAll(() => installDropGuard())

function drag(type: 'dragover' | 'drop', target: Element, types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  const dataTransfer = { types, dropEffect: 'copy' }
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
  return { cancelled: event.defaultPrevented, dropEffect: dataTransfer.dropEffect }
}

function mounted<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  document.body.append(el)
  return el
}

describe('installDropGuard', () => {
  it('файл мимо зон: бросок погашен, курсор «нельзя»', () => {
    const div = mounted('div')
    expect(drag('dragover', div, ['Files'])).toEqual({ cancelled: true, dropEffect: 'none' })
    expect(drag('drop', div, ['Files']).cancelled).toBe(true)
  })

  it('зона приняла файл — её выбор не трогаем', () => {
    const zone = mounted('div')
    zone.addEventListener('dragover', (e) => e.preventDefault())
    expect(drag('dragover', zone, ['Files']).dropEffect).toBe('copy')
  })

  it('файл на поле ввода тоже погашен: там он открылся бы вместо страницы', () => {
    const textarea = mounted('textarea')
    expect(drag('dragover', textarea, ['Files']).cancelled).toBe(true)
    expect(drag('drop', textarea, ['Files']).cancelled).toBe(true)
  })

  it('текст в поле ввода вставляется как раньше', () => {
    const input = mounted('input')
    expect(drag('dragover', input, ['text/plain']).cancelled).toBe(false)
    expect(drag('drop', input, ['text/plain']).cancelled).toBe(false)
  })

  it('ссылка мимо полей не открывается вместо страницы', () => {
    const div = mounted('div')
    expect(drag('drop', div, ['text/uri-list']).cancelled).toBe(true)
  })
})
