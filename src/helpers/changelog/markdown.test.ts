// Markdown заметок к релизу для «Что нового»: заголовки, абзацы, списки,
// жирный, курсив, код и ссылки. Текст экранируется (HTML из заметок не
// исполняется), ссылки с параметрами не ломаются двойным экранированием, а
// ссылка не на веб или почту остаётся простым текстом.

import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('заголовки, абзац из нескольких строк и разделитель', () => {
    expect(
      renderMarkdown('# v0.7.1 — Опросы\n\nПервая строка\nвторая строка\n\n---\n## Раздел')
    ).toBe(
      [
        '<h1>v0.7.1 — Опросы</h1>',
        '<p>Первая строка вторая строка</p>',
        '<hr />',
        '<h2>Раздел</h2>',
      ].join('\n')
    )
  })

  it('маркированный и нумерованный списки; • тоже маркер', () => {
    expect(renderMarkdown('- один\n* два\n• три')).toBe(
      '<ul><li>один</li><li>два</li><li>три</li></ul>'
    )
    expect(renderMarkdown('1. первый\n2. второй')).toBe('<ol><li>первый</li><li>второй</li></ol>')
  })

  it('список сразу после абзаца начинает новый блок', () => {
    expect(renderMarkdown('Что нового:\n- опросы')).toBe(
      '<p>Что нового:</p>\n<ul><li>опросы</li></ul>'
    )
  })

  it('жирный, курсив и код', () => {
    expect(renderMarkdown('**Опросы** в *ленте* и `s.poll`')).toBe(
      '<p><strong>Опросы</strong> в <em>ленте</em> и <code>s.poll</code></p>'
    )
  })

  it('HTML в тексте экранируется, а не исполняется', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)> & "кавычки"')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;кавычки&quot;</p>'
    )
  })

  it('ссылка открывается в новой вкладке, параметры не экранируются дважды', () => {
    expect(renderMarkdown('[релиз](https://github.com/x/releases?tab=1&page=2)')).toBe(
      '<p><a href="https://github.com/x/releases?tab=1&amp;page=2" target="_blank" rel="noopener noreferrer">релиз</a></p>'
    )
    expect(renderMarkdown('[почта](mailto:team@bastyon.com)')).toContain(
      'href="mailto:team@bastyon.com"'
    )
  })

  it('javascript: и другие схемы — не ссылка, остаётся подпись', () => {
    expect(renderMarkdown('[жми](javascript:void)')).toBe('<p>жми</p>')
    expect(renderMarkdown('[жми](JavaScript:void)')).toBe('<p>жми</p>')
    expect(renderMarkdown('[файл](file:///etc/passwd)')).toBe('<p>файл</p>')
  })

  it('кавычка в адресе не выходит из атрибута', () => {
    expect(renderMarkdown('[x](https://a.b/"onmouseover="alert(1))')).not.toContain('"onmouseover')
  })

  it('пустой текст и CRLF', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('# A\r\n\r\ntext')).toBe('<h1>A</h1>\n<p>text</p>')
  })

  it('настоящие заметки к релизу рендерятся без сырых маркеров', async () => {
    const { readFileSync } = await import('node:fs')
    const md = readFileSync('changelogs/v0.7.1/ru.desc.md', 'utf8')
    const html = renderMarkdown(md)
    expect(html.startsWith('<h1>v0.7.1')).toBe(true)
    expect(html).toContain('<h2>Опросы</h2>')
    expect(html).not.toMatch(/\*\*|^- /m)
  })
})
