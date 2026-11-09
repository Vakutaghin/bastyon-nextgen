/**
 * Ссылки на профиль и на коллекцию в тексте сообщения. «Отправить в чат»
 * шлёт их в формате bastyon.com (share-origin `chatLinks`), а здесь они
 * становятся карточками — как ссылка на пост (bastyon-link → PostEmbed).
 *
 *   https://bastyon.com/author?address=<адрес>  — профиль (так же ссылается прежний клиент)
 *   https://bastyon.com/collection?c=<txid>     — коллекция или плейлист
 *   bastyon://author?address=…, bastyon://collection?c=… — то же в схеме приложения
 *
 * Ссылка с другими параметрами остаётся обычной ссылкой: что в них — неизвестно.
 */

export type EntityLinkTarget =
  | { kind: 'profile'; address: string }
  | { kind: 'collection'; txid: string }

const HOSTS = '(?:www\\.)?(?:bastyon\\.com|pocketnet\\.app)'
const ADDRESS = 'P[1-9A-HJ-NP-Za-km-z]{25,40}'
const TXID = '[a-fA-F0-9]{64}'

/** Ссылки на профиль и коллекцию в тексте: группа 1 — адрес, группа 2 — txid коллекции. */
export const ENTITY_LINK_RE = new RegExp(
  `(?:bastyon:\\/\\/|https?:\\/\\/${HOSTS}\\/)` +
    `(?:author\\?address=(${ADDRESS})|collection\\?c=(${TXID}))` +
    // Дальше не продолжается параметрами или словом.
    '(?![\\w&=%#-])',
  'g'
)

/** Совпадение ENTITY_LINK_RE → что за сущность. */
export function entityOfMatch(match: RegExpExecArray): EntityLinkTarget | null {
  if (match[1]) return { kind: 'profile', address: match[1] }
  if (match[2]) return { kind: 'collection', txid: match[2].toLowerCase() }
  return null
}

/** Одна ссылка целиком — профиль или коллекция; иначе null. */
export function parseEntityLink(url: string): EntityLinkTarget | null {
  ENTITY_LINK_RE.lastIndex = 0
  const match = ENTITY_LINK_RE.exec(url.trim())
  ENTITY_LINK_RE.lastIndex = 0
  return match && match.index === 0 && match[0].length === url.trim().length
    ? entityOfMatch(match)
    : null
}
