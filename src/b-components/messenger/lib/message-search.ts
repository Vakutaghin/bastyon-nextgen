/**
 * Поиск по переписке, как в Telegram: слово запроса совпадает с началом
 * слова сообщения («прив» находит «Привет!»), без учёта регистра и разницы
 * ё/е; несколько слов — все, в любом порядке. Ищем в тексте, у файла и
 * голосового — в имени. Заглушку нерасшифрованного, удалённое и перевод
 * PKOIN не ищем: в их тексте нет того, что видно в чате.
 */

import { toRaw } from 'vue'
import type { Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../store/consts'
import { plainMentions } from './mentions'

/** Слово: буквы, знаки при буквах и цифры подряд. */
const WORD = /[\p{L}\p{M}\p{N}]+/gu

export function normalizeWord(word: string): string {
  return word.normalize('NFC').toLocaleLowerCase().replace(/ё/g, 'е')
}

const wordsOf = (text: string): string[] => (text.match(WORD) ?? []).map(normalizeWord)

/**
 * Слова сообщения, приведённые к виду запроса, — запоминаются: поиск по всем
 * чатам на каждую букву перебирает тысячи сообщений. Текст поменялся
 * (дорасшифровалось, отредактировали) — разбираются заново.
 */
const wordsCache = new WeakMap<object, { text: string; words: string[] }>()

/** Слова запроса, без повторов; пусто — искать нечего. */
export function searchTokens(query: string): string[] {
  const words = (query.match(WORD) ?? []).map(normalizeWord)
  return [...new Set(words)]
}

/**
 * Текст сообщения, по которому ищут; пусто — сообщение в поиске не участвует.
 * Упоминание — «@имя», как в пузыре: hex адреса не находится по цифрам.
 */
export function searchableText(message: Message): string {
  if (message.deleted || message.type === 'transaction') return ''
  const text = message.text || ''
  return text === ENCRYPTED_MESSAGE_PLACEHOLDER ? '' : plainMentions(text)
}

/** Все слова запроса — начала слов текста. */
export function matchesTokens(text: string, tokens: readonly string[]): boolean {
  if (!tokens.length || !text) return false
  return wordsMatch(wordsOf(text), tokens)
}

function wordsMatch(words: readonly string[], tokens: readonly string[]): boolean {
  return tokens.every((token) => words.some((word) => word.startsWith(token)))
}

export function messageMatches(message: Message, tokens: readonly string[]): boolean {
  if (!tokens.length) return false
  const text = searchableText(message)
  if (!text) return false
  const key = toRaw(message)
  let entry = wordsCache.get(key)
  if (entry?.text !== text) {
    entry = { text, words: wordsOf(text) }
    wordsCache.set(key, entry)
  }
  return wordsMatch(entry.words, tokens)
}

export interface TextRange {
  start: number
  end: number
}

/**
 * Что подсветить в исходном тексте: совпавшее начало каждого слова. Если
 * приведение изменило длину слова (редкие буквы), подсвечивается слово целиком.
 */
export function matchRanges(text: string, tokens: readonly string[]): TextRange[] {
  if (!tokens.length || !text) return []
  const out: TextRange[] = []
  for (const m of text.matchAll(WORD)) {
    const word = m[0]
    const normal = normalizeWord(word)
    let best = 0
    for (const token of tokens)
      if (token.length > best && normal.startsWith(token)) best = token.length
    if (!best) continue
    const start = m.index ?? 0
    out.push({ start, end: start + (normal.length === word.length ? best : word.length) })
  }
  return out
}

export interface TextPart {
  text: string
  /** Совпало с запросом — подсветить. */
  mark?: boolean
}

/** До первого совпадения в строке выдачи — не больше стольких знаков. */
export const SNIPPET_BEFORE = 16
/** Длиннее строка выдачи не бывает: дальше всё равно многоточие. */
export const SNIPPET_MAX = 160

/**
 * Кусок сообщения для строки выдачи поиска: в одну строку, первое
 * совпадение близко к началу (обрезано по слову, с «…»), совпавшее — отдельно,
 * чтобы подсветить.
 */
export function snippetParts(text: string, tokens: readonly string[]): TextPart[] {
  const flat = text.replace(/\s+/g, ' ').trim()
  const ranges = matchRanges(flat, tokens)
  const first = ranges[0]?.start ?? 0
  let from = 0
  if (first > SNIPPET_BEFORE) {
    const space = flat.indexOf(' ', first - SNIPPET_BEFORE)
    from = space >= 0 && space < first ? space + 1 : first
  }
  const to = Math.min(flat.length, from + SNIPPET_MAX)
  const parts: TextPart[] = from > 0 ? [{ text: '…' }] : []
  let at = from
  for (const r of ranges) {
    if (r.end <= at) continue
    if (r.start >= to) break
    if (r.start > at) parts.push({ text: flat.slice(at, r.start) })
    const end = Math.min(r.end, to)
    parts.push({ text: flat.slice(Math.max(r.start, at), end), mark: true })
    at = end
  }
  if (at < to) parts.push({ text: flat.slice(at, to) })
  if (to < flat.length) parts.push({ text: '…' })
  return parts
}
