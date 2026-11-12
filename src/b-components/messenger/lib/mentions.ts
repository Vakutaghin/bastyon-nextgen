/**
 * Упоминания в групповом чате, как в Telegram. Формат в тексте сообщения —
 * как у прежнего Bastyon и Forta Chat: `@<адрес в hex>:<имя>`, где hex — тот
 * же, что в Matrix-id участника, а в имени пробелы заменены на «_» и нет
 * знаков (ровно столько, сколько прочтут те клиенты). Человек видит «@имя»:
 * в пузыре — ссылкой на профиль, в списке чатов, ответе, поиске и при
 * копировании — текстом.
 */

import { addressToHex, hexToAddress } from '../services/matrix-service/address-codec'

/** `@<hex 34–68>:<имя>` — как MENTION_RE у Forta Chat; голый адрес — тоже. */
const MENTION_RE = /@([0-9a-fA-F]{34,68}|P[1-9A-HJ-NP-Za-km-z]{33}):([\p{L}\p{N}_]{1,50})/gu

/** Адрес Bastyon: base58. */
const ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{25,40}$/

export interface MentionMatch {
  start: number
  end: number
  /** Адрес Bastyon упомянутого. */
  address: string
  /** Имя, как его прислали (без «@»). */
  name: string
  raw: string
}

/** Адрес из того, что стоит после «@»: hex Matrix-id или сам адрес; иначе null. */
function addressOf(id: string): string | null {
  if (ADDRESS_RE.test(id) && id.startsWith('P')) return id
  if (id.length % 2 !== 0) return null
  const address = hexToAddress(id)
  return ADDRESS_RE.test(address) ? address : null
}

/** Упоминания в тексте по порядку. Похожее на упоминание, но без адреса, — не оно. */
export function findMentions(text: string): MentionMatch[] {
  if (!text || !text.includes('@')) return []
  const out: MentionMatch[] = []
  for (const m of text.matchAll(MENTION_RE)) {
    const address = addressOf(m[1]!)
    if (!address) continue
    out.push({
      start: m.index!,
      end: m.index! + m[0].length,
      address,
      name: m[2]!,
      raw: m[0],
    })
  }
  return out
}

/**
 * Текст, где упоминания — «@имя»: для списка чатов, ответа, поиска,
 * уведомления и буфера обмена. `nameOf` — имя из профиля (могли сменить);
 * нет — как прислали.
 */
export function plainMentions(
  text: string,
  nameOf?: (address: string) => string | undefined
): string {
  const found = findMentions(text)
  if (!found.length) return text
  let out = ''
  let at = 0
  for (const m of found) {
    out += text.slice(at, m.start) + `@${nameOf?.(m.address) || m.name}`
    at = m.end
  }
  return out + text.slice(at)
}

/** Имя для упоминания: пробелы — «_», без знаков; пусто — начало адреса. */
export function mentionName(name: string, address: string): string {
  const safe = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]/gu, '')
    .slice(0, 50)
  return safe || address.slice(0, 8)
}

/** Упоминание для отправки: `@<hex адреса>:<имя>`. */
export function mentionToken(address: string, name: string): string {
  return `@${addressToHex(address)}:${mentionName(name, address)}`
}

/** Набирают упоминание: «@» в начале слова и буквы после него до каретки. */
export interface MentionQuery {
  /** Где «@». */
  start: number
  /** Набранное после «@» (может быть пусто). */
  query: string
}

/**
 * Набирается ли упоминание у каретки: «@» в начале текста или после пробела,
 * между ним и кареткой — только буквы, цифры и «_». Иначе null.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret)
  const m = /(?:^|\s)@([\p{L}\p{N}_]{0,50})$/u.exec(before)
  if (!m) return null
  return { start: caret - m[1]!.length - 1, query: m[1]! }
}

/**
 * Выбрали участника: набранное «@бо» становится «@имя » (с пробелом — можно
 * писать дальше). В поле — имя, в сообщение уйдёт `@hex:имя` (encodeMentions).
 */
export function insertMentionAt(
  text: string,
  at: MentionQuery,
  caret: number,
  name: string,
  address: string
): { text: string; caret: number } {
  const inserted = `@${mentionName(name, address)} `
  const rest = text.slice(caret).replace(/^ /, '')
  return {
    text: text.slice(0, at.start) + inserted + rest,
    caret: at.start + inserted.length,
  }
}

/** Участник группы для упоминания. */
export interface MentionMember {
  address: string
  name: string
}

/**
 * Перед отправкой: «@имя» участника группы — в `@hex:имя`, как пишут прежний
 * Bastyon и Forta Chat. Имена в Bastyon уникальны, так что «@имя», набранное
 * руками, — тоже упоминание, как в Telegram. Почта (x@имя) и часть слова
 * (@имя2) не трогаются; уже готовые `@hex:имя` — тоже.
 */
export function encodeMentions(text: string, members: readonly MentionMember[]): string {
  if (!text.includes('@') || !members.length) return text
  const byName = new Map<string, MentionMember>()
  for (const m of members) byName.set(mentionName(m.name, m.address).toLowerCase(), m)
  return text.replace(
    /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_]{1,50})(?![\p{L}\p{N}_])/gu,
    (whole, lead: string, name: string) => {
      const member = byName.get(name.toLowerCase())
      return member ? `${lead}${mentionToken(member.address, member.name)}` : whole
    }
  )
}
