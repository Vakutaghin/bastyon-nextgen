// Переносы строк в комментарии: в msg — обычные \n, на экране — отдельные строки
// (раньше HTML склеивал ответ в одну строку).
import { describe, expect, it } from 'vitest'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { formatCommentMessageHtml } from './helpers'

const comment = (message: string): GetComment =>
  ({ msg: JSON.stringify({ message, url: '', images: [], info: '' }) }) as GetComment

describe('formatCommentMessageHtml', () => {
  it('\\n и \\r\\n становятся <br>, пустая строка между абзацами сохраняется', () => {
    expect(formatCommentMessageHtml(comment('раз\nдва\r\n\nтри'))).toBe('раз<br>два<br><br>три')
  })

  it('крайние переносы не дают пустых строк', () => {
    expect(formatCommentMessageHtml(comment('\n\nпривет\n'))).toBe('привет')
  })

  it('ссылки и меншены на соседних строках остаются ссылками', () => {
    const html = formatCommentMessageHtml(comment('@bob,\nсмотри https://example.com'))
    expect(html).toContain('<br>')
    expect(html).toContain('class="mention-link"')
    expect(html).toContain('href="https://example.com"')
  })

  it('разметка в тексте по-прежнему проходит санитайзер', () => {
    const html = formatCommentMessageHtml(comment('строка\n<img src=x onerror=alert(1)>'))
    expect(html).not.toContain('onerror')
  })
})
