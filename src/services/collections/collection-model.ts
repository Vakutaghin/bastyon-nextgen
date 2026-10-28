// Коллекция — транзакция 220 (метка OP_RETURN `collection`): название, обложка,
// описание и упорядоченный список txid публикаций. Формат 1:1 со старым
// клиентом (kit.js `Collection`, `collectionSettings`) и с нодой
// (pocketnet.core, models/dto/content/Collection.cpp).
//
// Плейлисты — те же коллекции. Отличает их поле `contentTypes`: одно число,
// тип транзакции элементов — 201 видео, 210 аудио. Нода поле хранит, включает в
// хеш и отдаёт, но после PIP 109 не проверяет и не фильтрует по нему. Старый
// клиент поле не шлёт: его коллекции — без типа, их раскладываем по элементам
// (collection-kind.ts).
//
// Чего нода не проверяет, проверяем здесь: до 100 элементов, без повторов,
// только txid, payload (`c + i + s + l`) не больше 2000 БАЙТ — кириллица
// занимает два, эмодзи четыре.

/** Что собрано: публикации любого типа, видео или аудио. */
export type CollectionKind = 'posts' | 'video' | 'audio'

/** Тип транзакции элементов для плейлистов. У коллекции публикаций поля нет. */
export const COLLECTION_CONTENT_TYPE = { video: 201, audio: 210 } as const

export const COLLECTION_MAX_ITEMS = 100
export const COLLECTION_MAX_PAYLOAD_BYTES = 2000
/** Длина названия — как у старого клиента. */
export const COLLECTION_CAPTION_MAX = 100
/** Правок одной коллекции за окно (consensus/Base.h). */
export const COLLECTION_EDIT_LIMIT = 5
/** Окно лимита правок в блоках — около месяца. */
export const COLLECTION_EDIT_WINDOW_BLOCKS = 43_200

const TXID_RE = /^[0-9a-f]{64}$/

export interface CollectionDraft {
  /** txid первой версии — при правке; у новой коллекции нет. */
  rootTxid?: string
  kind: CollectionKind
  caption: string
  description: string
  /** URL обложки; пусто — обложки нет. */
  image: string
  lang: string
  contentIds: string[]
  /** Прочие ключи настроек (`s`): чужие ключи при правке сохраняются. */
  settings?: Record<string, unknown>
}

/** Payload для `sendrawtransactionwithmessage`. */
export interface CollectionPayload {
  c: string
  i: string
  l: string
  s: string
  contentIds: string[]
  contentTypes?: number
  txidEdit: string
}

/** Тип по полю ноды (`"201"`, 201); не плейлист или поля нет — null. */
export function kindOfContentTypes(value: unknown): Exclude<CollectionKind, 'posts'> | null {
  const n = typeof value === 'string' ? Number(value) : value
  if (n === COLLECTION_CONTENT_TYPE.video) return 'video'
  if (n === COLLECTION_CONTENT_TYPE.audio) return 'audio'
  return null
}

export function contentTypesOf(kind: CollectionKind): number | undefined {
  return kind === 'posts' ? undefined : COLLECTION_CONTENT_TYPE[kind]
}

/** Настройки `s`: JSON-объект; строка, мусор и массив — пустой объект. */
export function parseCollectionSettings(raw: unknown): Record<string, unknown> {
  let value = raw
  if (typeof value === 'string') {
    if (!value) return {}
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return { ...(value as Record<string, unknown>) }
}

/** Описание лежит в настройках как `m` — у коллекции нет поля для текста. */
export function descriptionOf(settings: Record<string, unknown>): string {
  return typeof settings.m === 'string' ? settings.m : ''
}

/**
 * Строка настроек — как `collectionSettings.stringify` старого клиента:
 * пустое описание не пишется, пустые настройки не шлются вовсе.
 */
export function stringifyCollectionSettings(
  settings: Record<string, unknown> | undefined,
  description: string
): string {
  const out: Record<string, unknown> = { ...(settings ?? {}) }
  delete out.m
  const text = description.trim()
  if (text) out.m = text
  return Object.keys(out).length ? JSON.stringify(out) : ''
}

/** txid в нижнем регистре, без повторов, в исходном порядке. */
export function cleanContentIds(ids: readonly unknown[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string') continue
    const v = id.trim().toLowerCase()
    if (TXID_RE.test(v) && !out.includes(v)) out.push(v)
  }
  return out
}

export function collectionPayload(draft: CollectionDraft): CollectionPayload {
  const payload: CollectionPayload = {
    c: draft.caption.trim(),
    i: draft.image.trim(),
    l: draft.lang,
    s: stringifyCollectionSettings(draft.settings, draft.description),
    contentIds: cleanContentIds(draft.contentIds),
    txidEdit: draft.rootTxid ?? '',
  }
  const contentTypes = contentTypesOf(draft.kind)
  if (contentTypes !== undefined) payload.contentTypes = contentTypes
  return payload
}

/**
 * Строка под хеш — как `Collection::BuildHash`: root txid правки, тип
 * элементов, txid через запятую, затем `l c i s`, без разделителей.
 */
export function serializeCollection(payload: CollectionPayload): string {
  return (
    payload.txidEdit +
    (payload.contentTypes !== undefined ? String(payload.contentTypes) : '') +
    payload.contentIds.join(',') +
    payload.l +
    payload.c +
    payload.i +
    payload.s
  )
}

const encoder = new TextEncoder()

/** Сколько байт насчитает нода (`PayloadSize`): `c + i + s + l`, у правки ещё root txid. */
export function collectionPayloadBytes(payload: CollectionPayload): number {
  return (
    encoder.encode(payload.c).length +
    encoder.encode(payload.i).length +
    encoder.encode(payload.s).length +
    encoder.encode(payload.l).length +
    payload.txidEdit.length
  )
}

export type CollectionDraftError = 'caption' | 'empty' | 'tooMany' | 'tooBig'

export function validateCollectionDraft(draft: CollectionDraft): CollectionDraftError | null {
  const caption = draft.caption.trim()
  if (!caption || [...caption].length > COLLECTION_CAPTION_MAX) return 'caption'
  const payload = collectionPayload(draft)
  if (!payload.contentIds.length) return 'empty'
  if (payload.contentIds.length > COLLECTION_MAX_ITEMS) return 'tooMany'
  if (collectionPayloadBytes(payload) > COLLECTION_MAX_PAYLOAD_BYTES) return 'tooBig'
  return null
}
