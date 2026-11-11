/**
 * Поиск по переписке, как в Telegram: слово запроса совпадает с началом
 * слова сообщения («прив» находит «Привет!»), без учёта регистра и разницы
 * ё/е; несколько слов — все, в любом порядке. Ищем в тексте, у файла и
 * голосового — в имени. Заглушку нерасшифрованного, удалённое и перевод
 * PKOIN не ищем: в их тексте нет того, что видно в чате.
 */

import type { Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../store/consts'

/** Слово: буквы, знаки при буквах и цифры подряд. */
const WORD = /[\p{L}\p{M}\p{N}]+/gu

export function normalizeWord(word: string): string {
  return word.normalize('NFC').toLocaleLowerCase().replace(/ё/g, 'е')
}

/** Слова запроса, без повторов; пусто — искать нечего. */
export function searchTokens(query: string): string[] {
  const words = (query.match(WORD) ?? []).map(normalizeWord)
  return [...new Set(words)]
}

/** Текст сообщения, по которому ищут; пусто — сообщение в поиске не участвует. */
export function searchableText(message: Message): string {
  if (message.deleted || message.type === 'transaction') return ''
  const text = message.text || ''
  return text === ENCRYPTED_MESSAGE_PLACEHOLDER ? '' : text
}

/** Все слова запроса — начала слов текста. */
export function matchesTokens(text: string, tokens: readonly string[]): boolean {
  if (!tokens.length || !text) return false
  const words = (text.match(WORD) ?? []).map(normalizeWord)
  return tokens.every((token) => words.some((word) => word.startsWith(token)))
}

export function messageMatches(message: Message, tokens: readonly string[]): boolean {
  return matchesTokens(searchableText(message), tokens)
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
