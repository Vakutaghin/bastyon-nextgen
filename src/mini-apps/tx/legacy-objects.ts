/**
 * Транзакции, которые мини-приложения просят у хоста, в формате прежнего
 * клиента (pocketnet.gui `js/kit.js`: brtAccount, brtOffer, Comment,
 * UpvoteShare, Remove). У каждой:
 * - `serialized` — строка, чей hash256 уходит в OP_RETURN вторым пушем после
 *   метки типа; нода пересчитывает его из `message` и сверяет;
 * - `message` — тело `sendrawtransactionwithmessage` (`export()` прежнего клиента);
 * - `alias` — `export(true)`: его мини-приложение получает в `expObject`
 *   действия и по его полям узнаёт свои действия (Barteron — `isOfferAction` и т. п.).
 *
 * Сериализация brtoffer и brtaccount сверена с mainnet: hash256 совпал с
 * OP_RETURN у пяти объявлений (новых и правок) и пяти профилей Barteron.
 */

export interface LegacyTxObject {
  /** Метка в OP_RETURN и тип в `sendrawtransactionwithmessage`. */
  type: 'brtaccount' | 'brtoffer' | 'contentDelete' | 'comment' | 'upvoteShare'
  serialized: string
  message: Record<string, unknown>
  alias: Record<string, unknown>
  /** Третий пуш OP_RETURN (оценка: «адрес_автора значение»). */
  opReturnExtra?: string
}

/** Неверные данные от мини-приложения: код уходит ему как есть. */
export class LegacyObjectInvalid extends Error {
  readonly code: string
  constructor(type: string, field: string) {
    super(`${type}:invalid:${field}`)
    this.name = 'LegacyObjectInvalid'
    this.code = `${type}_invalid_${field}`
  }
}

type Data = Record<string, unknown>

const asData = (raw: unknown): Data =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Data) : {}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Адрес — всегда текущего пользователя: чужим подписать нельзя, нода отвергнет. */
function ownAddress(type: string, data: Data, user: string): string {
  if (typeof data.address === 'string' && data.address && data.address !== user) {
    throw new LegacyObjectInvalid(type, 'address')
  }
  return user
}

/** Профиль Barteron (brtaccount, тип 104). */
export function brtAccountObject(raw: unknown, user: string): LegacyTxObject {
  const d = asData(raw)
  const address = ownAddress('brtaccount', d, user)
  // Порядок ключей и пропуск undefined — как у JSON.stringify прежнего клиента.
  const s4 = JSON.stringify({
    a: d.tags,
    g: d.geohash,
    s: d.static,
    r: d.radius,
    d: d.safeDeal,
    m: d.metaData,
  })
  return {
    type: 'brtaccount',
    serialized: address + s4,
    message: { s1: address, p: { s4 } },
    // null вместо undefined: мост отдаёт ответ через JSON, и без ключа
    // Barteron не узнал бы в действии свой профиль (isAccountAction смотрит ключи).
    alias: {
      address,
      tags: d.tags ?? null,
      geohash: d.geohash ?? null,
      static: d.static ?? null,
      radius: d.radius ?? null,
      safeDeal: d.safeDeal ?? null,
      metaData: d.metaData ?? null,
    },
  }
}

/** Объявление Barteron (brtoffer, тип 211): новое или правка (`hash` — txid первой версии). */
export function brtOfferObject(raw: unknown, user: string): LegacyTxObject {
  const d = asData(raw)
  const address = ownAddress('brtoffer', d, user)
  const hash = typeof d.hash === 'string' && d.hash.length === 64 ? d.hash : null
  const language = str(d.language)
  const caption = str(d.caption)
  const description = str(d.description)
  const price = d.price
  // Проверки прежнего клиента (brtOffer.validation).
  if (!language) throw new LegacyObjectInvalid('brtoffer', 'language')
  if (!caption) throw new LegacyObjectInvalid('brtoffer', 'caption')
  if (!description) throw new LegacyObjectInvalid('brtoffer', 'description')
  if (d.tag === undefined || d.tag === null || d.tag === '') {
    throw new LegacyObjectInvalid('brtoffer', 'tag')
  }
  if (!d.tags) throw new LegacyObjectInvalid('brtoffer', 'tags')
  if (!d.condition) throw new LegacyObjectInvalid('brtoffer', 'condition')
  if (!Array.isArray(d.images)) throw new LegacyObjectInvalid('brtoffer', 'images')
  if (!str(d.geohash)) throw new LegacyObjectInvalid('brtoffer', 'geohash')
  if (typeof price !== 'number' || !Number.isFinite(price) || !(price > -1)) {
    throw new LegacyObjectInvalid('brtoffer', 'price')
  }
  const geohash = str(d.geohash)
  // Прежний клиент без видео дописывал в хэш «undefined», а в тело — ничего, и
  // нода такое отвергала. Пустая строка — то, что нода и сама подставит.
  const video = str(d.video)
  const s4 = JSON.stringify({
    t: d.tag,
    a: d.tags,
    c: d.condition,
    p: d.published,
    f: d.currencyPrice,
    d: d.delivery,
    v: d.videoSettings,
    s: d.safeDeal,
    m: d.metaData,
  })
  const s5 = JSON.stringify(d.images)
  return {
    type: 'brtoffer',
    serialized:
      address + (hash ?? '') + language + caption + description + s4 + s5 + geohash + video + price,
    message: {
      s1: address,
      ...(hash ? { s2: hash } : {}),
      p: { s1: language, s2: caption, s3: description, s4, s5, s6: geohash, s7: video, i1: price },
    },
    alias: {
      address,
      hash,
      language,
      caption,
      description,
      tag: d.tag,
      tags: d.tags,
      condition: d.condition,
      images: d.images,
      geohash,
      video,
      currencyPrice: d.currencyPrice ?? null,
      delivery: d.delivery ?? null,
      videoSettings: d.videoSettings ?? null,
      safeDeal: d.safeDeal ?? null,
      metaData: d.metaData ?? null,
      price,
      published: d.published ?? null,
    },
  }
}

/** Удаление контента (contentDelete, тип 207): у объявления — txid первой версии. */
export function removeObject(txidEdit: unknown): LegacyTxObject {
  if (typeof txidEdit !== 'string' || !/^[0-9a-f]{64}$/i.test(txidEdit)) {
    throw new LegacyObjectInvalid('contentDelete', 'hash')
  }
  return {
    type: 'contentDelete',
    serialized: txidEdit,
    message: { txidEdit },
    alias: { txidEdit, type: 'contentDelete' },
  }
}

/** Самый длинный текст комментария у прежнего клиента (Comment.validation). */
const COMMENT_MAX_LENGTH = 915

/** Комментарий (comment, тип 204): Barteron так пишет отзыв к объявлению. */
export function commentObject(raw: unknown): LegacyTxObject {
  const d = asData(raw)
  const postid = str(d.postid)
  if (!/^[0-9a-f]{64}$/i.test(postid)) throw new LegacyObjectInvalid('comment', 'postid')
  let parsed: Data = asData(d.msgparsed)
  if (!d.msgparsed && typeof d.msg === 'string') {
    try {
      parsed = asData(JSON.parse(d.msg))
    } catch {
      throw new LegacyObjectInvalid('comment', 'msg')
    }
  }
  const message = str(parsed.message)
  const url = str(parsed.url)
  const images = Array.isArray(parsed.images)
    ? parsed.images.filter((i): i is string => typeof i === 'string')
    : []
  const info = str(parsed.info)
  if (!message && !url && !images.length) throw new LegacyObjectInvalid('comment', 'content')
  if (message.length > COMMENT_MAX_LENGTH) throw new LegacyObjectInvalid('comment', 'messagelength')
  const parentid = str(d.parentid)
  const answerid = str(d.answerid)
  const msg = JSON.stringify({ message, url, images, info })
  return {
    type: 'comment',
    serialized: postid + msg + parentid + answerid,
    message: { postid, answerid, parentid, msg },
    alias: {
      postid,
      answerid,
      parentid,
      msgparsed: { message, url, images, info },
      type: 'comment',
    },
  }
}

/** Оценка (upvoteShare, тип 300): Barteron так ставит звёзды объявлению. */
export function upvoteShareObject(raw: unknown): LegacyTxObject {
  const d = asData(raw)
  const share = str(d.share)
  const vsaddress = str(d.vsaddress)
  const value = typeof d.value === 'number' ? String(d.value) : str(d.value)
  if (!/^[0-9a-f]{64}$/i.test(share)) throw new LegacyObjectInvalid('upvoteShare', 'share')
  if (!/^[1-5]$/.test(value)) throw new LegacyObjectInvalid('upvoteShare', 'value')
  if (!vsaddress) throw new LegacyObjectInvalid('upvoteShare', 'vsaddress')
  return {
    type: 'upvoteShare',
    serialized: share + value,
    message: { share, value },
    alias: { type: 'upvoteShare', share, value, vsaddress },
    opReturnExtra: `${vsaddress} ${value}`,
  }
}
