// Извлечение и нормализация связанных сущностей из ответа RPC `getmissedinfo`.
// RPC иногда прикладывает share/comment/user к событию — мы кешируем их в snapshot,
// чтобы UI рисовал превью и открывал PostModal без доп. запросов.

import type {
  NotificationItem,
  NotificationPostSnapshot,
  NotificationCommentSnapshot,
  NotificationUserSnapshot,
} from './notifications-types'
import { MES_TYPE_TITLE_KEYS } from './notifications-constants'
import { formatPkoin } from '@/helpers/common/pkoin-formatter'
import { DONATE_MARKER, opReturnText } from '@/helpers/common/op-return'

/** Первая непустая строка по списку ключей. */
export function pickStr(
  o: Record<string, unknown> | undefined | null,
  ...keys: string[]
): string | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

/** Первый массив по списку ключей. */
export function pickArr<T = unknown>(
  o: Record<string, unknown> | undefined | null,
  ...keys: string[]
): T[] | undefined {
  if (!o) return undefined
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v as T[]
  }
  return undefined
}

export function extractPostSnapshot(
  raw: unknown,
  fallbackTxid?: string
): NotificationPostSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const txid = pickStr(o, 'txid', 'hash', 'id') ?? fallbackTxid
  if (!txid) return undefined
  return {
    txid,
    caption: pickStr(o, 'c', 'caption', 'title'),
    message: pickStr(o, 'm', 'message', 'text'),
    type: pickStr(o, 'type'),
    images: pickArr<string>(o, 'i', 'images'),
  }
}

export function extractCommentSnapshot(
  raw: unknown,
  fallbackId?: string,
  fallbackPostId?: string
): NotificationCommentSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const id = pickStr(o, 'id', 'txid') ?? fallbackId
  if (!id) return undefined
  let message: string | undefined
  const msgRaw = o.msg ?? o.message
  if (typeof msgRaw === 'string') {
    try {
      const parsed = JSON.parse(msgRaw) as { message?: string }
      message = typeof parsed?.message === 'string' ? parsed.message : msgRaw
    } catch {
      message = msgRaw
    }
  } else if (msgRaw && typeof msgRaw === 'object') {
    const inner = (msgRaw as Record<string, unknown>).message
    if (typeof inner === 'string') message = inner
  }
  return {
    id,
    postid: pickStr(o, 'postid', 'rootTxHash', 'posttxid') ?? fallbackPostId,
    parentid: pickStr(o, 'parentid'),
    answerid: pickStr(o, 'answerid'),
    address: pickStr(o, 'address'),
    message,
  }
}

export function extractUserSnapshot(
  raw: unknown,
  fallbackAddress?: string
): NotificationUserSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    return fallbackAddress ? { address: fallbackAddress } : undefined
  }
  const o = raw as Record<string, unknown>
  const address = pickStr(o, 'address', 'addr') ?? fallbackAddress
  if (!address) return undefined
  return {
    address,
    name: pickStr(o, 'name'),
    avatar: pickStr(o, 'i', 'avatar'),
    reputation: typeof o.reputation === 'number' ? (o.reputation as number) : undefined,
  }
}

const ALLOWED_TYPES: NotificationItem['type'][] = [
  'comment',
  'like',
  'subscribe',
  'repost',
  'mention',
  'rating',
  'tip',
  'other',
]

const TYPE_MAP: Record<string, NotificationItem['type']> = {
  upvoteShare: 'rating',
  upvoteComment: 'rating',
  subscribe: 'subscribe',
  subscribePrivate: 'subscribe',
  unsubscribe: 'subscribe',
  answer: 'comment',
  comment: 'comment',
  repost: 'repost',
  transaction: 'tip',
  donation: 'tip',
}

/**
 * mesType приложения по событию ноды. Нода (pocketnet.core 0.22, GetMissedInfo
 * в WebSocketRpc.cpp) называет события по-своему, и раньше маппер их не
 * узнавал: комментарий к посту показывался «новым постом», а оценка
 * комментария, репост и буст — безымянным «Уведомлением». События ноды:
 *  - `msg: comment` + `mesType: post` — комментарий к вашему посту → `comment`;
 *  - `msg: comment` + `mesType: answer` — ответ на ваш комментарий;
 *  - `mesType: cScore` — оценка вашего комментария, ±1 → `upvoteComment`;
 *  - `msg: reshare` — репост вашего поста → `repost`;
 *  - `mesType: contentBoost` — буст вашего поста → `boost`;
 *  - `mesType: postfromprivate` — новый пост автора, у которого включён колокольчик;
 *  - `upvoteShare`, `subscribe`, `subscribePrivate`, `unsubscribe` — как есть.
 */
export function canonicalMesType(msg: unknown, mesType: unknown): string | undefined {
  if (msg === 'reshare') return 'repost'
  if (msg === 'comment' && mesType === 'post') return 'comment'
  if (mesType === 'cScore') return 'upvoteComment'
  if (mesType === 'contentBoost') return 'boost'
  return typeof mesType === 'string' && mesType ? mesType : undefined
}

/**
 * mesType записи из IDB. До исправления там лежали имена ноды, и `post`
 * означал комментарий к посту: новый пост теперь — `postfromprivate`.
 */
export function canonicalStoredMesType(mesType: string | undefined): string | undefined {
  if (mesType === 'post') return 'comment'
  return canonicalMesType(undefined, mesType)
}

/** Тип уведомления (иконка, фильтр, переход по клику) по mesType приложения. */
export function notificationTypeFor(mesType: string | undefined): NotificationItem['type'] {
  if (!mesType) return 'other'
  const mapped = TYPE_MAP[mesType]
  if (mapped) return mapped
  return ALLOWED_TYPES.includes(mesType as NotificationItem['type'])
    ? (mesType as NotificationItem['type'])
    : 'other'
}

/** Входящие переводы меньше этого не показываем — как старый клиент (спам «пылью»). */
export const MIN_TRANSFER_NOTIFY_PKOIN = 0.05

/** coinbase (2) и coinstake (3): входящие монеты в них — награда сети, а не перевод. */
const REWARD_TX_TYPES = new Set([2, 3])

export interface IncomingCoins {
  /** Сумма выходов на наш адрес, PKOIN. */
  amount: number
  /** Адрес первого входа: отправитель перевода (у награды — ставщик блока). */
  from?: string
  /** Награда из лотереи блока, а не перевод. */
  reward: boolean
  /** Текст из OP_RETURN перевода: сообщение отправителя или служебная метка (`a:donate`). */
  message?: string
}

/**
 * Входящие монеты из сырой транзакции getmissedinfo (числовой `type`, `vin`,
 * `vout`). Нода кладёт туда все транзакции с выходом на наш адрес, в том
 * числе сдачу от наших же постов, оценок и переводов, — поэтому транзакцию,
 * у которой первый вход наш, пропускаем. Раньше сырые транзакции
 * отбрасывались целиком, и о переводах и наградах уведомлений не было.
 */
export function incomingCoins(
  n: Record<string, unknown>,
  myAddress: string | null | undefined
): IncomingCoins | null {
  if (!myAddress || !Array.isArray(n.vout)) return null
  let amount = 0
  let message: string | undefined
  for (const out of n.vout as Array<{
    value?: unknown
    scriptPubKey?: { addresses?: unknown; hex?: unknown }
  }>) {
    const addresses = out?.scriptPubKey?.addresses
    if (Array.isArray(addresses) && addresses.includes(myAddress)) {
      amount += Number(out.value) || 0
    }
    const hex = out?.scriptPubKey?.hex
    if (message === undefined && typeof hex === 'string') message = opReturnText(hex)
  }
  if (!(amount > 0)) return null
  const vin = Array.isArray(n.vin) ? (n.vin as Array<{ address?: unknown }>) : []
  const first = vin.find((input) => typeof input?.address === 'string')?.address as
    | string
    | undefined
  if (first === myAddress) return null
  const reward = REWARD_TX_TYPES.has(Number(n.type))
  if (!reward && amount < MIN_TRANSFER_NOTIFY_PKOIN) return null
  return { amount, from: first, reward, message }
}

/** Сумма для описания: `+1.5 PKOIN` (от языка не зависит, поэтому хранится готовой). */
function amountLabel(satoshis: string | number): string {
  return `+${formatPkoin(satoshis, 8, false)} PKOIN`
}

/**
 * Маппит сырое событие из getmissedinfo в NotificationItem.
 * `myAddress` нужен для сырых транзакций: без него не отличить входящий
 * перевод от сдачи собственной транзакции.
 */
export function mapMissedEventToNotification(
  n: Record<string, unknown>,
  myAddress?: string | null
): NotificationItem | null {
  const id = (n.txid ?? n.id ?? n.nblock ?? Math.random().toString(36)) as string
  const hasEventMarker =
    (typeof n.mesType === 'string' && n.mesType.length > 0) ||
    (typeof n.msg === 'string' && n.msg.length > 0)

  // Сырая транзакция: входящий перевод, награда — или ничего (сдача, своя
  // регистрация, пополнение из крана меньше порога).
  if (!hasEventMarker && typeof n.type === 'number') {
    const coins = incomingCoins(n, myAddress)
    if (!coins) return null
    const donation = !coins.reward && coins.message === DONATE_MARKER
    const mesType = coins.reward ? 'win' : donation ? 'donation' : 'transaction'
    const amount = amountLabel(Math.round(coins.amount * 1e8))
    // Сообщение отправителя показываем, служебные метки (`a:…`) — нет.
    const note =
      mesType === 'transaction' && coins.message && !coins.message.startsWith('a:')
        ? ` · ${coins.message}`
        : ''
    return {
      id: String(id),
      nblock: Number(n.height ?? n.nblock ?? 0) || 0,
      type: coins.reward ? 'other' : 'tip',
      title: MES_TYPE_TITLE_KEYS[mesType] ?? 'notif.titleTip',
      description: amount + note,
      time: Number(n.nTime ?? n.time ?? 0) || Math.floor(Date.now() / 1000),
      seen: false,
      from: coins.reward ? undefined : coins.from,
      mesType,
    }
  }

  const nblock = Number(n.nblock ?? 0) || 0
  const rawMesType = n.mesType ?? n.type
  const time = Number(n.time ?? n.nTime ?? n.nblock ?? 0) || Math.floor(Date.now() / 1000)

  // Событие перевода в виде `msg: 'transaction'` + `amount` (так их шлёт
  // WebSocket прокси) — тоже входящие монеты.
  const isTipEvent = (n.msg === 'transaction' || rawMesType === 'transaction') && n.amount != null

  // Остальное без msg/mesType — не событие «кто-то что-то сделал»: без
  // фильтра оно рендерилось бы как «Кто-то · Уведомление» без деталей.
  if (!isTipEvent && !hasEventMarker) {
    return null
  }

  const mesType = isTipEvent ? 'transaction' : canonicalMesType(n.msg, rawMesType)
  // i18n-ключ заголовка; резолвится через t() в месте рендера (toast/дропдаун).
  const title = isTipEvent
    ? 'notif.titleTip'
    : ((mesType && MES_TYPE_TITLE_KEYS[mesType]) ?? 'notif.titleDefault')
  // Текст оценки не сохраняем (он застыл бы на языке момента записи) —
  // тост соберёт его из upvoteVal. Сумма от языка не зависит.
  const description = isTipEvent ? amountLabel(n.amount as string | number) : undefined
  const link = (n.url ?? n.link) as string | undefined

  const safeType: NotificationItem['type'] = isTipEvent ? 'tip' : notificationTypeFor(mesType)
  const upvoteVal = n.upvoteVal != null ? Number(n.upvoteVal) : undefined
  const fromAddress = (n.addrFrom ?? (n.account as Record<string, unknown>)?.address) as
    | string
    | undefined
  // Репост и новый пост автора — сами посты: их id и открываем.
  const shareId = (n.posttxid ??
    n.rootTxHash ??
    n.postHash ??
    (mesType === 'repost' || mesType === 'postfromprivate' ? n.txid : undefined)) as
    | string
    | undefined
  // Оценка комментария знает только комментарий; пост найдётся через него.
  const commentId = mesType === 'upvoteComment' ? pickStr(n, 'commentid') : undefined

  const postSnapshot = extractPostSnapshot(n.share, shareId)
  const commentSnapshot = extractCommentSnapshot(n.comment, String(id), shareId)
  // Буст и новый пост нода присылает с именем и аватаром автора.
  const userRaw =
    n.user ??
    (typeof n.nameFrom === 'string' && fromAddress
      ? { address: fromAddress, name: n.nameFrom, i: n.avatarFrom }
      : undefined)
  const fromSnapshot = extractUserSnapshot(userRaw, fromAddress)

  return {
    id: String(id),
    nblock,
    type: safeType,
    title: String(title),
    description,
    time,
    link,
    seen: false,
    from: fromAddress ?? fromSnapshot?.address,
    shareId,
    commentId,
    mesType,
    upvoteVal,
    postSnapshot,
    commentSnapshot,
    fromSnapshot,
  }
}
