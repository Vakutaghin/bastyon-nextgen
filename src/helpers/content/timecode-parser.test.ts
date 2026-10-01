// Главы видео из описания по правилам YouTube: минимум три тайм-кода,
// первый — 0:00, по возрастанию и не короче 10 с; иначе глав нет вовсе.
// Форматы M:SS, MM:SS, H:MM:SS; название — остаток строки без разделителей;
// описание бывает статьёй Editor.js с HTML внутри.

import { describe, expect, it } from 'vitest'
import {
  extractPlainTextFromContent,
  findActiveChapterIndex,
  nextTimecode,
  parseTimecodes,
  timecodeMatchToSeconds,
} from './timecode-parser'

function seconds(code: string): number | null {
  const match = nextTimecode(code)
  return match ? timecodeMatchToSeconds(match) : null
}

describe('тайм-коды', () => {
  it.each([
    ['0:00', 0],
    ['4:05', 245],
    ['59:59', 3599],
    ['99:00', 5940],
    ['1:02:03', 3723],
    ['01:02:03', 3723],
  ])('%s → %s с', (code, expected) => {
    expect(seconds(code)).toBe(expected)
  })

  it.each(['1:60', '1:60:00', '12:345', '3:4'])('%s — не тайм-код', (code) => {
    expect(seconds(code)).toBeNull()
  })

  it('цифры, склеенные с тайм-кодом, его не образуют', () => {
    expect(nextTimecode('версия 1:2:3:4')).toBeNull()
  })

  // Без lookbehind: цифру или двоеточие перед кодом проверяет nextTimecode.
  it.each(['911:23', 'a:12:34', '1:23:45:67'])('%s — код приклеен слева, не тайм-код', (text) => {
    expect(nextTimecode(text)).toBeNull()
  })

  it('находит все коды строки по очереди, с любой позиции', () => {
    const text = 'начало 0:05, потом 12:30 и 1:02:03.'
    const found: string[] = []
    for (let m = nextTimecode(text); m; m = nextTimecode(text, m.index + m[0].length)) {
      found.push(m[0])
    }
    expect(found).toEqual(['0:05', '12:30', '1:02:03'])
    expect(nextTimecode('(1:30) x', 1)?.[0]).toBe('1:30')
  })
})

describe('parseTimecodes', () => {
  const description = [
    'Подробный разбор',
    '0:00 Вступление',
    '1:30 — Что такое PKOIN',
    '12:05 | Кошелёк: 2 адреса',
    'Спасибо за просмотр!',
  ].join('\n')

  it('главы с названиями без разделителей', () => {
    expect(parseTimecodes(description)).toEqual([
      { start: 0, raw: '0:00', label: 'Вступление' },
      { start: 90, raw: '1:30', label: 'Что такое PKOIN' },
      { start: 725, raw: '12:05', label: 'Кошелёк 2 адреса' },
    ])
  })

  it('берётся первый тайм-код строки; строка из одного кода — название по коду', () => {
    const chapters = parseTimecodes('0:00\n0:30 Часть 1:00\n1:00:00 Финал')
    expect(chapters.map((c) => c.raw)).toEqual(['0:00', '0:30', '1:00:00'])
    expect(chapters[0]?.label).toBe('0:00')
    expect(chapters[1]?.label).toBe('Часть 1 00')
  })

  it.each([
    ['меньше трёх', '0:00 a\n1:00 b'],
    ['первая не с нуля', '0:05 a\n1:00 b\n2:00 c'],
    ['не по возрастанию', '0:00 a\n2:00 b\n1:00 c'],
    ['глава короче 10 с', '0:00 a\n0:09 b\n1:00 c'],
  ])('%s — глав нет', (_name, text) => {
    expect(parseTimecodes(text)).toEqual([])
  })

  it('статья Editor.js: абзацы, заголовки и списки, HTML и сущности снимаются', () => {
    const article = {
      blocks: [
        { type: 'header', data: { text: '0:00 <b>Начало</b>' } },
        { type: 'paragraph', data: { text: '0:45 Вопросы&nbsp;&amp;&nbsp;ответы<br>1:30 Итоги' } },
        { type: 'image', data: { file: { url: 'x' } } },
        { type: 'list', data: { items: ['2:00 Бонус'] } },
      ],
    }
    expect(parseTimecodes(article).map((c) => c.label)).toEqual([
      'Начало',
      'Вопросы & ответы',
      'Итоги',
      'Бонус',
    ])
    expect(parseTimecodes(JSON.stringify(article))).toHaveLength(4)
  })

  it('пустое и битое содержимое — без глав и без исключений', () => {
    expect(parseTimecodes(null)).toEqual([])
    expect(parseTimecodes('   ')).toEqual([])
    expect(extractPlainTextFromContent('{"blocks": [oops')).toBe('{"blocks": [oops')
    expect(extractPlainTextFromContent({ blocks: 'nope' })).toBe('')
  })
})

describe('findActiveChapterIndex', () => {
  const chapters = [
    { start: 0, raw: '0:00', label: 'a' },
    { start: 60, raw: '1:00', label: 'b' },
    { start: 120, raw: '2:00', label: 'c' },
  ]

  it.each([
    [0, 0],
    [59.9, 0],
    [60, 1],
    [500, 2],
  ])('время %s с → глава %s', (time, index) => {
    expect(findActiveChapterIndex(chapters, time)).toBe(index)
  })

  it('без глав — -1', () => {
    expect(findActiveChapterIndex([], 10)).toBe(-1)
  })
})
