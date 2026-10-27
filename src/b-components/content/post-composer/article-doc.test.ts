// Статья: блоки Editor.js ↔ документ редактора. Правка старой статьи не
// должна ничего терять: ни разметку в тексте, ни подписи, ни блоки, которых
// редактор не знает. Новый редактор пишет те же блоки, что Editor.js.

import { describe, expect, it } from 'vitest'

import type { ArticleContent } from '@/blockchain/core/actions/post-action'

import { articleToDoc, docToArticle, inlineFromHtml, inlineToHtml } from './article-doc'

const roundTrip = (blocks: unknown[]): unknown[] =>
  docToArticle(articleToDoc({ blocks } as ArticleContent), 1).blocks

describe('строчная разметка', () => {
  it('жирный, курсив, ссылка и перенос — туда и обратно', () => {
    const html =
      'Привет, <b>мир</b> и <i>курсив <b>с жирным</b></i><br><a href="https://x.org/?a=1&amp;b=2">ссылка</a>'
    const nodes = inlineFromHtml(html)
    expect(nodes).toContainEqual({ type: 'hardBreak' })
    expect(nodes).toContainEqual({
      type: 'text',
      text: 'с жирным',
      marks: [{ type: 'italic' }, { type: 'bold' }],
    })
    expect(inlineToHtml(nodes)).toBe(
      'Привет, <b>мир</b> и <i>курсив </i><b><i>с жирным</i></b><br><a href="https://x.org/?a=1&amp;b=2">ссылка</a>'
    )
  })

  it('текст экранируется, хвостовые переносы Editor.js отбрасываются', () => {
    expect(inlineToHtml(inlineFromHtml('a &lt; b &amp; c<br><br>'))).toBe('a &lt; b &amp; c')
    expect(inlineFromHtml('')).toEqual([])
  })

  it('чужие теги — только их текст', () => {
    expect(inlineToHtml(inlineFromHtml('<span class="x">раз</span> <mark>два</mark>'))).toBe(
      'раз два'
    )
  })
})

describe('блоки Editor.js ↔ документ', () => {
  it('абзац, заголовок, код, разделитель', () => {
    const blocks = [
      { type: 'header', data: { text: 'Глава', level: 2 } },
      { type: 'paragraph', data: { text: 'Текст <b>жирный</b>' } },
      { type: 'code', data: { code: 'const a = 1\nconst b = "<x>"' } },
      { type: 'delimiter', data: {} },
    ]
    expect(roundTrip(blocks)).toEqual(blocks)
  })

  it('списки: v1 строками и v2 объектами; вложенные — плоско', () => {
    expect(
      roundTrip([
        { type: 'list', data: { style: 'ordered', items: ['раз', '<i>два</i>'] } },
        {
          type: 'list',
          data: {
            style: 'unordered',
            items: [{ content: 'верх', items: [{ content: 'вложенный', items: [] }] }],
          },
        },
      ])
    ).toEqual([
      { type: 'list', data: { style: 'ordered', items: ['раз', '<i>два</i>'] } },
      { type: 'list', data: { style: 'unordered', items: ['верх', 'вложенный'] } },
    ])
  })

  it('цитата с подписью и картинка с флагами сохраняются', () => {
    const blocks = [
      {
        type: 'quote',
        data: { text: 'Слова<br>в две строки', caption: 'Автор', alignment: 'center' },
      },
      {
        type: 'image',
        data: {
          file: { url: 'https://img/1.jpg' },
          caption: 'Подпись',
          withBorder: true,
          stretched: false,
          withBackground: true,
        },
      },
    ]
    expect(roundTrip(blocks)).toEqual(blocks)
  })

  it('незнакомый блок (таблица) проходит насквозь как есть', () => {
    const table = { id: 'T1', type: 'table', data: { content: [['a', 'b']], withHeadings: false } }
    expect(roundTrip([table])).toEqual([table])
  })

  it('пустые абзацы и пустые блоки не попадают в статью', () => {
    expect(
      roundTrip([
        { type: 'paragraph', data: { text: '' } },
        { type: 'header', data: { text: '' } },
        { type: 'image', data: { file: {} } },
        { type: 'paragraph', data: { text: 'есть' } },
      ])
    ).toEqual([{ type: 'paragraph', data: { text: 'есть' } }])
  })

  it('пустая статья — один пустой абзац; наружу — формат Editor.js', () => {
    expect(articleToDoc(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(docToArticle({ type: 'doc', content: [{ type: 'paragraph' }] }, 7)).toEqual({
      time: 7,
      blocks: [],
      version: '2.31.6',
    })
  })
})
