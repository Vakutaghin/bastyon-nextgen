import { describe, expect, it } from 'vitest'
import { githubSlug, Slugger } from './help-slug'
import { splitFrontmatter } from './help-frontmatter'
import { parseArticle, type HelpParseContext } from './help-markdown'

const ctx: HelpParseContext = {
  topic: 'sample',
  resolveImage: (path) => (path === '../images/p2p.svg' ? '/assets/p2p.svg' : null),
  resolveApp: (href) => (href === 'bastyon://my-files' ? '/my-files' : null),
}

const parse = (source: string) => parseArticle(source, ctx)
const text = (v: string) => ({ t: 'text', v })

describe('githubSlug', () => {
  it('как на GitHub: строчные, без знаков, пробелы — дефисы, кириллица остаётся', () => {
    expect(githubSlug('Что такое PKOIN?')).toBe('что-такое-pkoin')
    expect(githubSlug('1. Создайте аккаунт')).toBe('1-создайте-аккаунт')
    expect(githubSlug('Hello, World!')).toBe('hello-world')
    expect(githubSlug('Ёлка и ёж')).toBe('ёлка-и-ёж')
    expect(githubSlug('🌐 Файл через IPFS')).toBe('-файл-через-ipfs')
    expect(githubSlug('snake_case и dash-case')).toBe('snake_case-и-dash-case')
  })

  it('повторы получают -1, -2', () => {
    const slugger = new Slugger()
    expect(['a', 'a', 'a', 'a-1'].map((s) => slugger.slug(s))).toEqual(['a', 'a-1', 'a-2', 'a-1-1'])
  })
})

describe('splitFrontmatter', () => {
  it('списки в строку и столбиком, кавычки, комментарии', () => {
    const { meta, body, problems } = splitFrontmatter(
      '---\nkeywords: [IPFS, "большие, файлы", \'ключ\']  # для указателя\nplatforms: [desktop]\ncode:\n  - src/pages/my-files-page\n  - "src-tauri/src/ipfs"\n---\n\n# Статья\n'
    )
    expect(meta).toEqual({
      keywords: ['IPFS', 'большие, файлы', 'ключ'],
      platforms: ['desktop'],
      code: ['src/pages/my-files-page', 'src-tauri/src/ipfs'],
      draft: false,
    })
    expect(body).toBe('\n# Статья\n')
    expect(problems).toEqual([])
  })

  it('без шапки — пусто; незнакомые ключи и платформы — ошибки', () => {
    expect(splitFrontmatter('# Статья').meta).toEqual({
      keywords: [],
      platforms: [],
      code: [],
      draft: false,
    })
    const { meta, problems } = splitFrontmatter('---\ntitle: x\nplatforms: [desktop, tv]\n---\n# T')
    expect(meta.platforms).toEqual(['desktop'])
    expect(problems).toHaveLength(2)
  })

  it('черновик: draft true или false, иное — ошибка', () => {
    expect(splitFrontmatter('---\ndraft: true\n---\n# T').meta.draft).toBe(true)
    expect(splitFrontmatter('---\ndraft: false\n---\n# T').meta.draft).toBe(false)
    const { meta, problems } = splitFrontmatter('---\ndraft: yes\n---\n# T')
    expect(meta.draft).toBe(false)
    expect(problems).toEqual([expect.stringContaining('draft: true или false')])
  })
})

describe('parseArticle', () => {
  it('заголовок — первый уровень; якоря разделов — как на GitHub', () => {
    const doc = parse(
      '# Файлы через IPFS\n\nЛид.\n\n## Как это работает?\n\n## Как это работает?\n'
    )
    expect(doc.title).toBe('Файлы через IPFS')
    expect(doc.headings.map((h) => h.id)).toEqual(['как-это-работает', 'как-это-работает-1'])
    expect(doc.blocks[0]).toEqual({ t: 'p', c: [text('Лид.')] })
    expect(doc.problems).toEqual([])
  })

  it('без заголовка и со вторым заголовком первого уровня — ошибка', () => {
    expect(parse('Текст').problems).toHaveLength(1)
    expect(parse('# A\n\n# B\n').problems).toHaveLength(1)
  })

  it('ссылки: статья, раздел, свой раздел, словарь, главная, приложение, внешняя, битые', () => {
    const doc = parse(
      '# T\n\n[a](other.md) [b](other.md#раздел) [c](#свой) [d](glossary.md#cid) [e](README.md) ' +
        '[f](bastyon://my-files) [g](https://example.com/x) [h](bastyon://nope) [i](../x/other.md)\n'
    )
    expect(doc.links.map((l) => l.to)).toEqual([
      { kind: 'topic', topic: 'other', anchor: null },
      { kind: 'topic', topic: 'other', anchor: 'раздел' },
      { kind: 'topic', topic: 'sample', anchor: 'свой' },
      { kind: 'term', anchor: 'cid' },
      { kind: 'home' },
      { kind: 'app', href: 'bastyon://my-files', path: '/my-files' },
      { kind: 'external', href: 'https://example.com/x' },
      { kind: 'broken', href: 'bastyon://nope' },
      { kind: 'broken', href: '../x/other.md' },
    ])
    expect(doc.links.map((l) => l.text).join('')).toBe('abcdefghi')
  })

  it('врезки GitHub — маркер своей строкой или отдельным абзацем; обычная цитата остаётся цитатой', () => {
    const doc = parse('# T\n\n> [!WARNING]\n> Необратимо.\n\n> [!tip]\n>\n> Совет.\n\n> Цитата.\n')
    expect(doc.blocks).toEqual([
      { t: 'alert', kind: 'warning', c: [{ t: 'p', c: [text('Необратимо.')] }] },
      { t: 'alert', kind: 'tip', c: [{ t: 'p', c: [text('Совет.')] }] },
      { t: 'quote', c: [{ t: 'p', c: [text('Цитата.')] }] },
    ])
  })

  it('<details> — сворачиваемые подробности с разметкой внутри', () => {
    const doc = parse(
      '# T\n\n<details>\n<summary>Как это устроено</summary>\n\nВнутри **жирный**.\n\n</details>\n\nПосле.\n'
    )
    expect(doc.blocks).toEqual([
      {
        t: 'details',
        summary: 'Как это устроено',
        c: [{ t: 'p', c: [text('Внутри '), { t: 'strong', c: [text('жирный')] }, text('.')] }],
      },
      { t: 'p', c: [text('После.')] },
    ])
    expect(doc.problems).toEqual([])
  })

  it('прочий HTML не выводится разметкой и попадает в ошибки; комментарии молча пропускаются', () => {
    const doc = parse(
      '# T\n\n<div onclick="x">hi</div>\n\nтекст <b>жирный</b>\n\n<!-- заметка -->\n'
    )
    expect(doc.problems).toHaveLength(3)
    expect(doc.blocks).toEqual([
      { t: 'p', c: [text('<div onclick="x">hi</div>')] },
      { t: 'p', c: [text('текст <b>жирный</b>')] },
    ])
  })

  it('таблица с выравниванием', () => {
    expect(parse('# T\n\n| A | B |\n|:--|--:|\n| 1 | 2 |\n').blocks[0]).toEqual({
      t: 'table',
      align: ['left', 'right'],
      head: [[text('A')], [text('B')]],
      rows: [[[text('1')], [text('2')]]],
    })
  })

  it('списки: плотный, с абзацами, нумерованный не с единицы', () => {
    expect(parse('# T\n\n- a\n- b\n').blocks[0]).toMatchObject({
      t: 'list',
      ordered: false,
      tight: true,
    })
    expect(parse('# T\n\n- a\n\n- b\n').blocks[0]).toMatchObject({ tight: false })
    const ordered = parse('# T\n\n3. c\n4. d\n').blocks[0]
    expect(ordered).toMatchObject({ t: 'list', ordered: true, start: 3 })
    expect(ordered?.t === 'list' && ordered.items.length).toBe(2)
  })

  it('картинки: своя из help/images, вариант для тёмной темы; внешняя и несуществующая — ошибки', () => {
    const doc = parse(
      '# T\n\n![Схема](../images/p2p.svg#gh-dark-mode-only) ![x](https://evil.example/x.png) ![y](../images/none.svg)\n'
    )
    const first = doc.blocks[0]
    expect(first?.t === 'p' && first.c[0]).toEqual({
      t: 'image',
      src: '/assets/p2p.svg',
      alt: 'Схема',
      theme: 'dark',
    })
    expect(doc.problems).toHaveLength(2)
  })

  it('текст для поиска — без разметки', () => {
    expect(parse('# T\n\n## Раздел\n\nТекст с `кодом`\nи [ссылкой](x.md).\n').text).toBe(
      'Раздел Текст с кодом и ссылкой.'
    )
  })
})
