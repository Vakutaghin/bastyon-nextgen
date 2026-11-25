// Как записывается тег и какие хэштеги текста становятся тегами. Образец —
// прежний Bastyon: clearTagString и tagsFromText.
import { describe, expect, it } from 'vitest'

import { MAX_TAGS } from './consts'
import {
  hashtagsIn,
  normalizeTag,
  seenHashtags,
  type TagsFromText,
  tagsFromText,
  withTypedTag,
} from './post-tags'

const tagsOf = (text: string) => hashtagsIn(text).map((item) => item.tag)

describe('normalizeTag', () => {
  it('подчёркивание остаётся: «крипта_пкоин» — не «криптапкоин»', () => {
    expect(normalizeTag('крипта_пкоин')).toBe('крипта_пкоин')
    expect(normalizeTag('Невероятно_Но_Факт')).toBe('невероятно_но_факт')
    expect(normalizeTag('pkoin_commerce')).toBe('pkoin_commerce')
  })

  it('буквы любого языка остаются', () => {
    for (const tag of ['kryptowährung', 'liberté', 'españa', '中国', '유머', 'животиње', 'україна'])
      expect(normalizeTag(tag)).toBe(tag)
  })

  it('буква двумя знаками (й = и + бреве) — та же буква, что одним', () => {
    expect(normalizeTag('новый'.normalize('NFD'))).toBe('новый'.normalize('NFC'))
  })

  it('пробелы между словами — подчёркивание, знаки препинания и эмодзи убираются', () => {
    expect(normalizeTag('  назад в  ссср ')).toBe('назад_в_ссср')
    expect(normalizeTag('#covid-19!')).toBe('covid19')
    expect(normalizeTag('любовь❤️')).toBe('любовь')
    expect(normalizeTag(`новини${String.fromCodePoint(0x200b)}`)).toBe('новини')
  })

  it('без букв и цифр — не тег', () => {
    for (const raw of ['', ' ', '#', '___', '🔥', '❤️']) expect(normalizeTag(raw)).toBe('')
  })

  it('не длиннее 40 знаков, знак вне BMP не режется пополам', () => {
    expect(normalizeTag('а'.repeat(60))).toHaveLength(40)
    const rare = String.fromCodePoint(0x20000)
    expect(normalizeTag(rare.repeat(60))).toBe(rare.repeat(40))
  })
})

describe('withTypedTag', () => {
  it('повтор, пустой и лишний сверх предела не добавляются', () => {
    expect(withTypedTag(['море'], 'Море')).toEqual(['море'])
    expect(withTypedTag(['море'], '  ')).toEqual(['море'])
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(withTypedTag(full, 'ещё')).toEqual(full)
    expect(withTypedTag(full.slice(1), 'ещё')).toHaveLength(MAX_TAGS)
  })

  it('предел — 15, как в прежнем Bastyon', () => {
    expect(MAX_TAGS).toBe(15)
  })
})

describe('hashtagsIn', () => {
  it('список тегов в любой записи: через пробел, запятую, строками, слитно', () => {
    expect(tagsOf('#крипта_пкоин #море, #горы;\n#лес')).toEqual([
      'крипта_пкоин',
      'море',
      'горы',
      'лес',
    ])
    expect(tagsOf('#море#горы#лес')).toEqual(['море', 'горы', 'лес'])
    expect(tagsOf('Текст (#море). «#горы» — "#лес"!')).toEqual(['море', 'горы', 'лес'])
  })

  it('места — для слова под курсором', () => {
    expect(hashtagsIn('Я на #море!')).toEqual([{ tag: 'море', start: 5, end: 10 }])
  })

  it('решётка внутри слова и якорь ссылки — не теги', () => {
    expect(tagsOf('C# и F#m, дом№5 a#b#c')).toEqual([])
    expect(tagsOf('https://a.ru/page#top http://b.ru/?#x bastyon://post#y')).toEqual([])
    expect(tagsOf('https://a.ru/page#top #море')).toEqual(['море'])
  })

  it('заголовок разметки и пустая решётка — не теги, двойная решётка — тег', () => {
    expect(tagsOf('# Заголовок ## и # ещё #')).toEqual([])
    expect(tagsOf('##море')).toEqual(['море'])
  })
})

describe('tagsFromText', () => {
  const empty: TagsFromText = { tags: [], seen: [] }

  /** Набрать текст по букве, как с клавиатуры: курсор всегда в конце. */
  function type(text: string, state: TagsFromText = empty, from = ''): TagsFromText {
    let before = from
    let next = state
    for (const char of text) {
      const value = before + char
      next = tagsFromText(next, value, before, value.length)
      before = value
    }
    return next
  }

  it('вставленный список — теги сразу, и последний тоже', () => {
    const text = 'Мой пост\n\n#крипта_пкоин #море #горы'
    expect(tagsFromText(empty, text, 'Мой пост\n\n', text.length).tags).toEqual([
      'крипта_пкоин',
      'море',
      'горы',
    ])
  })

  it('набираемое слово — не тег, пока не закончено', () => {
    expect(type('Я на #море').tags).toEqual([])
    expect(type('Я на #море ').tags).toEqual(['море'])
    expect(type('Я на #море, и #горы!').tags).toEqual(['море', 'горы'])
  })

  it('из текста ушли — закончено и слово под курсором', () => {
    const typed = type('Я на #море')
    expect(tagsFromText(typed, 'Я на #море', 'Я на #море', null).tags).toEqual(['море'])
  })

  it('правка посреди хэштега не даёт обрывков', () => {
    const state = type('#мре ')
    // Вставили «о» в середину: слово ещё правят.
    const fixed = tagsFromText(state, '#море ', '#мре ', 3)
    expect(fixed.tags).toEqual(['мре'])
    expect(tagsFromText(fixed, '#море  ', '#море ', 7).tags).toEqual(['мре', 'море'])
  })

  it('тег, убранный крестиком, с тем же текстом не возвращается', () => {
    const state = type('#море #горы ')
    const removed = { ...state, tags: ['горы'] }
    expect(type('и ещё текст ', removed, '#море #горы ').tags).toEqual(['горы'])
    expect(tagsFromText(removed, '#море #горы ', '#море #горы ', null).tags).toEqual(['горы'])
  })

  it('стёртый из текста список теги не снимает, написанный заново — снова тег', () => {
    const state = type('#море ')
    const erased = tagsFromText(state, '', '#море ', 0)
    expect(erased).toEqual({ tags: ['море'], seen: [] })
    expect(type('#море ', { ...erased, tags: [] }).tags).toEqual(['море'])
  })

  it('что было в тексте при открытии — уже разобрано', () => {
    const text = 'Пост с #море'
    const state = { tags: ['отпуск'], seen: seenHashtags(text) }
    expect(tagsFromText(state, text, text, null).tags).toEqual(['отпуск'])
  })

  it('сверх предела не добавляются', () => {
    const text = Array.from({ length: 20 }, (_, i) => `#t${i}`).join(' ')
    expect(tagsFromText(empty, text, '', text.length).tags).toHaveLength(MAX_TAGS)
  })
})
