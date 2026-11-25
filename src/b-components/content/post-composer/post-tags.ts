// Теги поста: как тег записывается и какие хэштеги есть в тексте. Чистые
// функции: их зовут и окно поста, и окно загрузки в «Медиастудии».
//
// Запись тега повторяет прежний Bastyon (clearTagString): строчные буквы,
// пробелы — подчёркиванием, знаки препинания убираются. Нода сравнивает теги
// буква в букву, поэтому «крипта_пкоин» и «криптапкоин» — разные теги.
import { MAX_TAGS } from './consts'

/** Сколько знаков в теге: без предела слово без пробелов растянуло бы окно. */
const MAX_TAG_LENGTH = 40

/** Всё, кроме букв любого алфавита, цифр и подчёркивания. */
const NOT_TAG_CHARS = /[^\p{L}\p{M}\p{N}_]/gu

/** Знаки вида эмодзи: сами эмодзи убираются, а эти невидимы и остались бы в теге. */
const EMOJI_MARKS = /[\u{FE00}-\u{FE0F}\u{20E3}]/gu

/** Чем отделены теги в списке: пробелами, переводами строк, запятыми, решётками. */
export const TAG_SEPARATORS = /[\s,;#]+/

/** Тег, как он уйдёт в сеть; пустая строка — в нём нет ни буквы, ни цифры. */
export function normalizeTag(raw: string): string {
  const tag = raw
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(EMOJI_MARKS, '')
    .replace(NOT_TAG_CHARS, '')
  if (!/[\p{L}\p{N}]/u.test(tag)) return ''
  return Array.from(tag).slice(0, MAX_TAG_LENGTH).join('')
}

/** Теги с ещё одним: повтор, пустой и лишний сверх предела не добавляются. */
export function withTypedTag(tags: readonly string[], typed: string): string[] {
  const tag = normalizeTag(typed)
  return tag && !tags.includes(tag) && tags.length < MAX_TAGS ? [...tags, tag] : [...tags]
}

/** Хэштег в тексте: тег и где он стоит (`start` — решётка, `end` — за последним знаком). */
export interface TextHashtag {
  tag: string
  start: number
  end: number
}

/** Где кончается хэштег: пробел, знаки конца слова, скобки, кавычки, другая решётка. */
const HASHTAG = /#([^\s#,.!?;:()[\]{}«»"“”„…]+)/gu

/** После чего решётка начинает хэштег: начало текста, пробел, знак препинания, другой хэштег. */
const BEFORE_HASHTAG = /[\s,.!?;:()[\]{}«»"“”„…]/u

/** Ссылки из текста убираются: `#` в них — якорь страницы. */
const LINK = /[a-z][a-z0-9+.-]*:\/\/\S+/giu

export function hashtagsIn(text: string): TextHashtag[] {
  const source = text.replace(LINK, (link) => ' '.repeat(link.length))
  const found: TextHashtag[] = []
  let previousEnd = -1
  for (const match of source.matchAll(HASHTAG)) {
    const start = match.index
    const glued = start === previousEnd
    const before = start > 0 ? source[start - 1]! : ''
    if (!glued && before && before !== '#' && !BEFORE_HASHTAG.test(before)) continue
    const end = start + match[0].length
    previousEnd = end
    const tag = normalizeTag(match[1]!)
    if (tag) found.push({ tag, start, end })
  }
  return found
}

/** Хэштеги текста: что из них уже разобрано, второй раз не добавляем. */
export function seenHashtags(text: string): string[] {
  return [...new Set(hashtagsIn(text).map((item) => item.tag))]
}

export interface TagsFromText {
  tags: string[]
  /** Хэштеги текста, которые уже разобраны. */
  seen: string[]
}

/**
 * Теги с хэштегами текста — как в прежнем Bastyon: вставили в текст список
 * «#крипта #пкоин», и теги встали в поле. Добавляется только новое: тег,
 * убранный крестиком, с тем же текстом не вернётся, а удалённый из текста
 * хэштег тег не снимает — список тегов в тексте часто вставляют только ради
 * тегов и потом стирают.
 *
 * Слово под курсором, которое набирают по букве (`caret`, `before` — текст до
 * правки), ещё не тег: иначе встали бы «к», «кр», «кри»… Вставленное целиком —
 * тег сразу. `caret: null` — ввод закончен, считаются все слова.
 */
export function tagsFromText(
  state: TagsFromText,
  text: string,
  before: string,
  caret: number | null
): TagsFromText {
  let tags = state.tags
  const seen = new Set<string>()
  for (const { tag, start, end } of hashtagsIn(text)) {
    const typing =
      caret !== null && caret > start && caret <= end && before.startsWith(text.slice(0, start + 1))
    if (state.seen.includes(tag)) {
      seen.add(tag)
    } else if (!typing) {
      seen.add(tag)
      tags = withTypedTag(tags, tag)
    }
  }
  return { tags, seen: [...seen] }
}
