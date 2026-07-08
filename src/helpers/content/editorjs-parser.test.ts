import { describe, it, expect } from 'vitest'
import { editorjsToHtml } from './editorjs-parser'

/**
 * Регресс на P1-1: `editorjsToHtml` собирает HTML интерполяцией и рендерится
 * через v-html. img `file.url`/`caption` — недоверенный ввод; без escape +
 * финального sanitizeHtml из него вырывался бы onerror-хендлер / <script>.
 */

function parse(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

describe('editorjsToHtml — XSS (P1-1)', () => {
  it('image.file.url не может вырваться из src и навесить onerror', () => {
    const html = editorjsToHtml({
      blocks: [
        {
          type: 'image',
          data: {
            file: { url: 'https://img.host/1.png"><img src=x onerror=alert(1)>' },
            caption: 'ok',
          },
        },
      ],
    })
    const dom = parse(html)
    // Ни один реальный img-узел не несёт onerror-хендлер.
    dom.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('onerror')).toBeNull()
    })
    // Инъецированный breakout не создал исполняемых узлов.
    expect(dom.querySelector('script')).toBeNull()
  })

  it('caption с <script> вырезается финальным sanitizeHtml', () => {
    const html = editorjsToHtml({
      blocks: [
        {
          type: 'image',
          data: { file: { url: 'https://img.host/1.png' }, caption: '<script>alert(1)</script>' },
        },
      ],
    })
    expect(html).not.toContain('<script>')
    expect(parse(html).querySelector('script')).toBeNull()
  })

  it('легитимный контент выживает (параграф + делимитер с классом)', () => {
    const html = editorjsToHtml({
      blocks: [
        { type: 'paragraph', data: { text: 'Hello world' } },
        { type: 'delimiter', data: {} },
        {
          type: 'image',
          data: { file: { url: 'https://img.host/pic.png' }, caption: 'подпись' },
        },
      ],
    })
    expect(html).toContain('Hello world')
    // hr сохраняет класс делимитера (whitelist теперь разрешает class на hr).
    expect(html).toContain('ce-delimiter')
    // Легитимный src проходит.
    expect(html).toContain('https://img.host/pic.png')
    expect(html).toContain('подпись')
  })
})
