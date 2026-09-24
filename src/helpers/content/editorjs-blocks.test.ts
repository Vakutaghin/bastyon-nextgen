import { describe, expect, it } from 'vitest'
import { normalizeListItems, normalizeTableRows } from './editorjs-blocks'
import { editorjsToHtml } from './editorjs-parser'

// S25: превью и полный вид расходились в наборе блоков и в форме данных.
describe('normalizeListItems', () => {
  it('строки Editor.js v1 остаются как есть', () => {
    expect(normalizeListItems(['раз', 'два'])).toEqual(['раз', 'два'])
  })

  it('объекты v2 отдают content, а не [object Object]', () => {
    expect(normalizeListItems([{ content: 'раз' }, { content: 'два' }])).toEqual(['раз', 'два'])
  })

  it('вложенные пункты разворачиваются следом за родителем', () => {
    const items = [{ content: 'раз', items: [{ content: 'раз-а' }] }, { content: 'два' }]
    expect(normalizeListItems(items)).toEqual(['раз', 'раз-а', 'два'])
  })

  it('мусор не ломает список', () => {
    expect(normalizeListItems(undefined)).toEqual([])
    expect(normalizeListItems('строка')).toEqual([])
    expect(normalizeListItems([null, 42, { nope: 1 }])).toEqual([])
  })
})

describe('normalizeTableRows', () => {
  it('оставляет строки таблицы массивами строк', () => {
    expect(normalizeTableRows([['a', 'b'], ['c']])).toEqual([['a', 'b'], ['c']])
  })

  it('пропускает не-массивы', () => {
    expect(normalizeTableRows(['строка', ['a']])).toEqual([['a']])
    expect(normalizeTableRows(null)).toEqual([])
  })
})

describe('editorjsToHtml — блоки, которых превью раньше не знало (S25)', () => {
  const wrap = (blocks: unknown[]) => JSON.stringify({ blocks })

  it('таблица больше не исчезает', () => {
    const html = editorjsToHtml(
      wrap([
        {
          type: 'table',
          data: {
            withHeadings: true,
            content: [
              ['Имя', 'Цена'],
              ['a', '1'],
            ],
          },
        },
      ])
    )
    expect(html).toContain('<table')
    expect(html).toContain('Имя')
    expect(html).toContain('<th>')
  })

  it('ссылка-карточка рендерится ссылкой', () => {
    const html = editorjsToHtml(
      wrap([{ type: 'link', data: { link: 'https://example.com', meta: { title: 'Пример' } } }])
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('Пример')
  })

  it('список v2 не даёт [object Object]', () => {
    const html = editorjsToHtml(
      wrap([{ type: 'list', data: { style: 'unordered', items: [{ content: 'пункт' }] } }])
    )
    expect(html).toContain('<li>пункт</li>')
    expect(html).not.toContain('[object Object]')
  })

  it('разделитель остаётся разделителем', () => {
    expect(editorjsToHtml(wrap([{ type: 'delimiter', data: {} }]))).toContain('<hr')
  })
})
