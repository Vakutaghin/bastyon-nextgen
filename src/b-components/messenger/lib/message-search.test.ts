// Поиск по переписке: начала слов, регистр и ё/е, несколько слов в любом
// порядке, что подсветить; удалённое, заглушка и перевод в поиске не участвуют.

import { describe, expect, it } from 'vitest'
import type { Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../store/consts'
import {
  SNIPPET_BEFORE,
  SNIPPET_MAX,
  matchRanges,
  matchesTokens,
  messageMatches,
  searchTokens,
  searchableText,
  snippetParts,
} from './message-search'

const msg = (over: Partial<Message>): Message => ({
  id: '$1',
  chatId: '!r',
  senderId: '@a',
  text: '',
  timestamp: 1,
  read: true,
  status: 'sent',
  ...over,
})

describe('searchTokens', () => {
  it('слова запроса в нижнем регистре, ё как е, без повторов и знаков', () => {
    expect(searchTokens('  Ёлка, ёлка — ЗЕЛЁНАЯ! ')).toEqual(['елка', 'зеленая'])
  })

  it('пустой и из одних знаков — искать нечего', () => {
    expect(searchTokens('')).toEqual([])
    expect(searchTokens(' ?! — ')).toEqual([])
  })
})

describe('matchesTokens', () => {
  it('слово запроса — начало слова: «прив» находит «Привет!», но не «опривет»', () => {
    expect(matchesTokens('Привет!', searchTokens('прив'))).toBe(true)
    expect(matchesTokens('опривет', searchTokens('прив'))).toBe(false)
  })

  it('ё и е не различаются ни в запросе, ни в тексте', () => {
    expect(matchesTokens('Всё ещё ждём', searchTokens('все'))).toBe(true)
    expect(matchesTokens('Все уже тут', searchTokens('всё'))).toBe(true)
  })

  it('несколько слов — все и в любом порядке', () => {
    const text = 'Встреча завтра в офисе в 10:00'
    expect(matchesTokens(text, searchTokens('офис завтра'))).toBe(true)
    expect(matchesTokens(text, searchTokens('офис послезавтра'))).toBe(false)
  })

  it('цифры, ссылки и латиница — по частям', () => {
    expect(matchesTokens('Смотри https://bastyon.com/post?s=1', searchTokens('bastyon.com'))).toBe(
      true
    )
    expect(matchesTokens('Счёт 2024-07 оплачен', searchTokens('2024'))).toBe(true)
  })
})

describe('searchableText', () => {
  it('файл и голосовое — по имени', () => {
    expect(searchableText(msg({ type: 'file', text: 'отчёт.pdf' }))).toBe('отчёт.pdf')
  })

  it('удалённое, нерасшифрованное и перевод PKOIN — не ищутся', () => {
    expect(searchableText(msg({ text: 'x', deleted: { by: '@a', at: 2 } }))).toBe('')
    expect(searchableText(msg({ text: ENCRYPTED_MESSAGE_PLACEHOLDER }))).toBe('')
    expect(searchableText(msg({ type: 'transaction', text: '{"txid":"привет"}' }))).toBe('')
    expect(messageMatches(msg({ text: ENCRYPTED_MESSAGE_PLACEHOLDER }), ['encrypted'])).toBe(false)
  })
})

describe('matchRanges', () => {
  it('подсвечивается совпавшее начало каждого слова', () => {
    const text = 'Привет, привередливый Иван!'
    expect(matchRanges(text, searchTokens('прив иван'))).toEqual([
      { start: 0, end: 4 },
      { start: 8, end: 12 },
      { start: 22, end: 26 },
    ])
  })

  it('из нескольких подходящих слов запроса — самое длинное', () => {
    expect(matchRanges('привет', ['п', 'прив'])).toEqual([{ start: 0, end: 4 }])
  })

  it('ничего не совпало — пусто', () => {
    expect(matchRanges('Привет', searchTokens('пока'))).toEqual([])
  })
})

describe('messageMatches', () => {
  it('текст сообщения поменялся (дорасшифровалось) — ищется по новому', () => {
    const m = msg({ text: ENCRYPTED_MESSAGE_PLACEHOLDER })
    expect(messageMatches(m, ['отпуск'])).toBe(false)
    m.text = 'Планы на отпуск'
    expect(messageMatches(m, ['отпуск'])).toBe(true)
    m.text = 'Планы на выходные'
    expect(messageMatches(m, ['отпуск'])).toBe(false)
  })
})

describe('snippetParts', () => {
  const join = (parts: { text: string; mark?: boolean }[]) =>
    parts.map((p) => (p.mark ? `[${p.text}]` : p.text)).join('')

  it('короткое — целиком, совпавшее отдельно, переводы строк — пробелы', () => {
    expect(join(snippetParts('Планы\nна отпуск', searchTokens('отпу')))).toBe('Планы на [отпу]ск')
  })

  it('совпадение далеко от начала — начало срезано по слову, с многоточием', () => {
    const text = `${'слово '.repeat(10)}про отпуск и море`
    const out = join(snippetParts(text, searchTokens('отпуск')))
    expect(out.startsWith('…')).toBe(true)
    expect(out).toContain('[отпуск] и море')
    expect(out.indexOf('[')).toBeLessThanOrEqual(SNIPPET_BEFORE + 1)
    expect(out.slice(1, 2)).not.toBe(' ')
  })

  it('длинное — обрезано, с многоточием в конце', () => {
    const out = snippetParts(`отпуск ${'а'.repeat(500)}`, searchTokens('отпуск'))
    expect(out[0]).toEqual({ text: 'отпуск', mark: true })
    expect(out[out.length - 1]).toEqual({ text: '…' })
    expect(out.map((p) => p.text).join('').length).toBeLessThanOrEqual(SNIPPET_MAX + 1)
  })
})
