import { describe, expect, it } from 'vitest'
import { buildHelpLibrary, resolveRelative, type HelpSources } from './help-library'
import { helpSearch } from './help-search'
import { markWords, queryStems, stemEn, stemRu } from './help-stem'

const FILES: Record<string, string> = {
  'ru/README.md':
    '# Справка\n\nВступление.\n\n## Содержание\n\n- [Основы](basics.md)\n  - [Ключи](keys.md)\n- [Словарь](glossary.md)\n',
  'ru/basics.md':
    '---\nkeywords: [основы, Bastyon]\nplatforms: [desktop]\ncode: [src/x]\n---\n\n# Основы\n\nПро [ключи](keys.md#резервная-копия) и [CID](glossary.md#cid).\n',
  'ru/keys.md':
    '# Ключи\n\nКлюч аккаунта получается из фразы.\n\n## Резервная копия\n\nЗапишите фразу на бумаге.\n',
  'ru/glossary.md':
    '# Словарь\n\n## CID\n\nАдрес файла по содержимому.\n\n## Узел\n\nКомпьютер сети.\n',
  'en/README.md':
    '# Help\n\nIntro.\n\n## Contents\n\n- [Basics](basics.md)\n  - [Keys](keys.md)\n- [Glossary](glossary.md)\n',
  'en/basics.md': '---\nkeywords: [basics]\n---\n\n# Basics\n\nAbout [keys](keys.md).\n',
  'en/glossary.md': '# Glossary\n\n## CID\n\nContent address.\n',
}

function sources(files: Record<string, string> = FILES): HelpSources {
  return {
    files,
    images: {},
    resolveApp: (href) => (href === 'bastyon://wallets' ? '/wallets' : null),
  }
}

describe('buildHelpLibrary', () => {
  it('оглавление, порядок чтения, крошки, словарь и указатель', () => {
    const lib = buildHelpLibrary('ru', sources())
    expect(lib.problems).toEqual([])
    expect(lib.title).toBe('Справка')
    expect(lib.intro).toEqual([{ t: 'p', c: [{ t: 'text', v: 'Вступление.' }] }])
    expect(lib.toc).toEqual([
      { id: 'basics', label: 'Основы', children: [{ id: 'keys', label: 'Ключи', children: [] }] },
      { id: 'glossary', label: 'Словарь', children: [] },
    ])
    expect(lib.order).toEqual(['basics', 'keys', 'glossary'])
    expect(lib.trail.get('keys')).toEqual(['basics'])
    expect([...lib.glossary.keys()]).toEqual(['cid', 'узел'])
    expect(lib.glossary.get('cid')?.blocks).toEqual([
      { t: 'p', c: [{ t: 'text', v: 'Адрес файла по содержимому.' }] },
    ])
    // Заголовок и ключевое слово «основы» — одна запись; кириллица в русском указателе раньше латиницы.
    expect(lib.index.map((e) => e.keyword)).toEqual(['Ключи', 'Основы', 'Словарь', 'Bastyon'])
    expect(lib.index.find((e) => e.keyword === 'Основы')?.topics).toEqual(['basics'])
    const basics = lib.topics.get('basics')
    expect(basics?.platforms).toEqual(['desktop'])
    expect(basics?.code).toEqual(['src/x'])
  })

  it('английская справка: свой текст, платформы из русской, нет статьи — русская', () => {
    const lib = buildHelpLibrary('en', sources())
    expect(lib.problems).toEqual([])
    expect(lib.title).toBe('Help')
    expect(lib.topics.get('basics')).toMatchObject({
      title: 'Basics',
      keywords: ['basics'],
      platforms: ['desktop'],
      fallback: false,
    })
    expect(lib.topics.get('keys')).toMatchObject({ title: 'Ключи', fallback: true })
    expect([...lib.glossary.keys()]).toEqual(['cid'])
  })

  it('ошибки в файлах собираются, а не ломают справку', () => {
    const lib = buildHelpLibrary(
      'en',
      sources({
        ...FILES,
        'ru/orphan.md':
          '# Сирота\n\n[нет](missing.md) [раздел](keys.md#нет) [термин](glossary.md#нет) [app](bastyon://nope)\n',
        'en/basics.md': '---\nplatforms: [web]\n---\n\n# Basics\n',
        'en/extra.md': '# Extra\n',
      })
    )
    const messages = lib.problems.map((p) => `${p.file}: ${p.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('en/extra.md: статьи нет на русском'),
        expect.stringContaining('en/basics.md: platforms и code'),
        expect.stringContaining('ru/orphan.md: статьи нет в оглавлении'),
        expect.stringContaining('статью, которой нет: missing.md'),
        expect.stringContaining('нет раздела #нет'),
        expect.stringContaining('нет термина #нет'),
        expect.stringContaining('никуда не ведёт: [app](bastyon://nope)'),
      ])
    )
    expect(lib.order).toEqual(['basics', 'keys', 'glossary'])
  })

  describe('черновики', () => {
    // «Основы» — черновая книга с готовой статьёй внутри, у «Ключей» не
    // дописан перевод, на «Основы» ссылается словарь.
    const DRAFTS: Record<string, string> = {
      ...FILES,
      'ru/basics.md': '---\ndraft: true\n---\n\n# Основы\n\nПлан книги.\n',
      'ru/glossary.md': '# Словарь\n\n## CID\n\nАдрес файла, см. [основы](basics.md).\n',
      'en/basics.md': '---\ndraft: true\n---\n\n# Basics\n\nPlan.\n',
      'en/keys.md': '---\ndraft: true\n---\n\n# Keys\n\nPlan.\n',
    }

    it('в сборке: черновика нет, готовая статья поднимается на место книги', () => {
      const lib = buildHelpLibrary('ru', sources(DRAFTS))
      expect(lib.problems).toEqual([])
      expect(lib.topics.has('basics')).toBe(false)
      expect(lib.toc).toEqual([
        { id: 'keys', label: 'Ключи', children: [] },
        { id: 'glossary', label: 'Словарь', children: [] },
      ])
      expect(lib.order).toEqual(['keys', 'glossary'])
      expect(lib.trail.get('keys')).toEqual([])
      expect(lib.index.map((e) => e.keyword)).not.toContain('Основы')
      expect(helpSearch(lib).search('план')).toEqual([])
      // Ссылка на скрытый черновик остаётся текстом.
      const link = lib.glossary.get('cid')?.blocks[0]
      expect(link).toMatchObject({ c: [{}, { t: 'link', to: { kind: 'broken' } }, {}] })
    })

    it('в сборке: недописанный перевод заменяется русской статьёй', () => {
      const lib = buildHelpLibrary('en', sources(DRAFTS))
      expect(lib.topics.get('keys')).toMatchObject({ title: 'Ключи', fallback: true, draft: false })
    })

    it('при разработке черновики видны и помечены', () => {
      const lib = buildHelpLibrary('en', { ...sources(DRAFTS), drafts: true })
      expect(lib.problems).toEqual([])
      expect(lib.topics.get('keys')).toMatchObject({ title: 'Keys', fallback: false, draft: true })
      expect(lib.toc[0]).toMatchObject({ id: 'basics', draft: true })
      expect(lib.order).toEqual(['basics', 'keys', 'glossary'])
    })
  })

  it('путь картинки считается от папки языка', () => {
    expect(resolveRelative('ru', '../images/p2p.svg')).toBe('images/p2p.svg')
    expect(resolveRelative('ru', './a/../b.svg')).toBe('ru/b.svg')
  })
})

describe('стемминг', () => {
  it('русский: формы одного слова сходятся к одной основе', () => {
    expect(['ключ', 'ключи', 'ключей', 'ключами', 'ключом'].map(stemRu)).toEqual(
      Array(5).fill('ключ')
    )
    expect(['фраза', 'фразы', 'фразу', 'фразой'].map(stemRu)).toEqual(Array(4).fill('фраз'))
    expect(['блокчейн', 'блокчейна', 'блокчейне'].map(stemRu)).toEqual(Array(3).fill('блокчейн'))
    expect(stemRu('публикации')).toBe(stemRu('публикация'))
    expect(stemRu('подписки')).toBe(stemRu('подписка'))
    expect(stemRu('ёлка')).toBe('елк')
  })

  it('английский: множественное число, -ed, -ing', () => {
    expect(['key', 'keys'].map(stemEn)).toEqual(['key', 'key'])
    expect(['encrypt', 'encrypted', 'encrypting'].map(stemEn)).toEqual(Array(3).fill('encrypt'))
    expect(['story', 'stories'].map(stemEn)).toEqual(['stori', 'stori'])
    expect(stemEn('phrases')).toBe('phrase')
    expect(stemEn('hopping')).toBe('hop')
    expect(stemEn('agreed')).toBe('agree')
    expect(stemEn('feed')).toBe('feed')
  })

  it('подсветка: служебные слова не ищутся, найденные отмечены', () => {
    expect(queryStems('и в на')).toEqual([])
    expect(markWords('Храните ключи офлайн', queryStems('ключ'))).toEqual([
      { text: 'Храните ', mark: false },
      { text: 'ключи', mark: true },
      { text: ' офлайн', mark: false },
    ])
  })
})

describe('HelpSearch', () => {
  const lib = buildHelpLibrary('ru', sources())

  it('находит по форме слова, выше — совпадение в заголовке', () => {
    const hits = helpSearch(lib).search('ключей')
    expect(hits[0]?.id).toBe('keys')
    expect(hits.map((h) => h.id)).toContain('basics')
    expect(hits[0]?.snippet.some((p) => p.mark)).toBe(true)
  })

  it('все слова не нашлись вместе — ищет по любому', () => {
    expect(
      helpSearch(lib)
        .search('фразу несуществующееслово')
        .map((h) => h.id)
    ).toEqual(['keys'])
  })

  it('пустой запрос и одни служебные слова — пусто', () => {
    expect(helpSearch(lib).search('  ')).toEqual([])
    expect(helpSearch(lib).search('и на')).toEqual([])
  })

  it('индекс один на загруженную справку', () => {
    expect(helpSearch(lib)).toBe(helpSearch(lib))
  })
})
