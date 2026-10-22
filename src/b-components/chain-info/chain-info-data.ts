/**
 * Данные модалки «В блокчейне»: запросы к ноде и их разбор. Всё публичное —
 * без подписи, через ту же ноду, что и обозреватель. Форматы сверены с
 * mainnet 23.10.2026.
 */

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { unwrapRpcArray, unwrapRpcResponse } from '@/helpers/common/response-parser'
import { getExplorerRpcConfig } from '@/composables/use-explorer-preferred-node'
import type { Transaction } from '@/types/rpc-responses/get-transactions'
import type { GetComment } from '@/types/rpc-responses/get-comments'

const SATOSHI = 100_000_000

/** Убрать хвост плавающей точки: 8 знаков, как у сатоши. */
const pkoin = (value: number): number => Math.round(value * SATOSHI) / SATOSHI

async function rpc(
  method: string,
  parameters: unknown[],
  { noFailover = false }: { noFailover?: boolean } = {}
): Promise<unknown> {
  const raw = await getByPRC(
    { method, parameters, options: { auth: false, noFailover } },
    getExplorerRpcConfig()
  )
  if (raw && typeof raw === 'object' && (raw as { result?: string }).result === 'error') {
    throw new Error((raw as { error?: string }).error || 'RPC error')
  }
  return raw
}

// ── Пост ────────────────────────────────────────────────────────────────

/** Пост, как он записан: поля полезной нагрузки и счётчики ноды. */
export interface ChainContent {
  /** txid первой публикации — id поста. */
  txid: string
  /** txid текущей версии: после правок — последней. */
  hash: string
  address: string
  /** share, video, article, audio… */
  type: string
  time: number
  /** Язык. */
  l?: string
  /** Заголовок. */
  c?: string
  /** Текст. */
  m?: string
  /** Ссылка или видео. */
  u?: string
  /** Теги. */
  t?: string[]
  /** Картинки. */
  i?: string[]
  /** Репост: txid исходного поста. */
  r?: string
  s?: Record<string, unknown>
  /** Прежние версии: высота блока и txid. Пустой — правок не было. */
  versions?: { h: number; hs: string }[]
  scoreCnt?: number
  scoreSum?: number
  comments?: number
  reposted?: number
  deleted?: boolean | string
  userprofile?: { name?: string; i?: string; reputation?: number }
  [key: string]: unknown
}

export async function fetchContent(txid: string): Promise<ChainContent | null> {
  const raw = await rpc(rpcEndpoints.getRawTransactionWithMessageById, [[txid]])
  return unwrapRpcArray<ChainContent>(raw)[0] ?? null
}

export interface ContentVersion {
  txid: string
  /** Высота из списка версий; у текущей версии нода её не пишет. */
  height?: number
  /** 0 — публикация, дальше — номер правки. */
  index: number
  current: boolean
}

/**
 * Версии поста от публикации к последней правке. В `versions` нода кладёт
 * прежние версии — первой идёт публикация, — а текущая лежит в `hash`.
 */
export function contentVersions(
  content: Pick<ChainContent, 'txid' | 'hash' | 'versions'>
): ContentVersion[] {
  const previous = (content.versions ?? []).filter((v) => v?.hs)
  const current = content.hash || content.txid
  const list: ContentVersion[] = previous
    .filter((v) => v.hs !== current)
    .map((v, index) => ({ txid: v.hs, height: v.h, index, current: false }))
  if (!list.length || list[0]!.txid !== content.txid) {
    // Публикации нет в списке — не правился, или нода отдала список без неё.
    if (content.txid !== current) {
      list.unshift({ txid: content.txid, index: 0, current: false })
    }
  }
  list.forEach((v, i) => (v.index = i))
  list.push({ txid: current, index: list.length, current: true })
  return list
}

/** Средняя оценка, 0 — оценок нет. */
export function averageScore(content: Pick<ChainContent, 'scoreCnt' | 'scoreSum'>): number {
  const cnt = Number(content.scoreCnt) || 0
  if (!cnt) return 0
  return Math.round(((Number(content.scoreSum) || 0) / cnt) * 10) / 10
}

/** Длина текста в символах (не в байтах UTF-16): эмодзи — один символ. */
export function textLength(text: string | undefined): number {
  return text ? Array.from(text).length : 0
}

/** То, что записано, без того, что нода приложила от себя (профиль, последний комментарий). */
export function storedContent(content: ChainContent): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...content }
  delete rest.userprofile
  delete rest.lastComment
  return rest
}

export interface ContentActor {
  address: string
  /** Имя, если у всех записей ноды оно одно; иначе догрузится по адресу. */
  name?: string
  avatar?: string
  /** Оценка 1–5. У бустов и монет — не показываем (см. fetchContentActions). */
  value?: number
}

export interface ContentActions {
  scores: ContentActor[]
  boosters: ContentActor[]
  donors: ContentActor[]
}

interface RawAction {
  address?: string
  name?: string
  avatar?: string
  value?: number
}

/**
 * Нода повторяет запись столько раз, сколько версий профиля у человека, — с
 * разными именами (getcontentactions соединяет со всеми версиями). Оставляем
 * одну на адрес; имя — только если во всех записях оно одинаковое.
 */
export function uniqueActors(list: readonly RawAction[], withValue: boolean): ContentActor[] {
  const byAddress = new Map<string, { actor: ContentActor; names: Set<string> }>()
  for (const a of list) {
    if (!a?.address) continue
    const seen = byAddress.get(a.address)
    if (!seen) {
      byAddress.set(a.address, {
        actor: {
          address: a.address,
          avatar: a.avatar || undefined,
          value: withValue ? Number(a.value) || undefined : undefined,
        },
        names: new Set(a.name ? [a.name] : []),
      })
      continue
    }
    if (a.name) seen.names.add(a.name)
    if (!seen.actor.avatar && a.avatar) seen.actor.avatar = a.avatar
  }
  return [...byAddress.values()].map(({ actor, names }) => ({
    ...actor,
    name: names.size === 1 ? [...names][0] : undefined,
  }))
}

/**
 * Кто оценил, бустил и приложил монеты к комментарию. Суммы бустов и монет
 * нода считает в 32-битном целом (WebRpcRepository::GetContentActions,
 * TryGetColumnInt): всё, что больше ~21,47 PKOIN, переполняется — сумма
 * выходит неверной, а отрицательная запись вовсе выпадает. Поэтому суммы не
 * показываем, только кто.
 */
export async function fetchContentActions(txid: string): Promise<ContentActions> {
  const raw = await rpc('getcontentactions', [txid])
  const data = unwrapRpcResponse<{
    scores?: RawAction[]
    boosts?: RawAction[]
    donations?: RawAction[]
  }>(raw)
  return {
    scores: uniqueActors(data?.scores ?? [], true),
    boosters: uniqueActors(data?.boosts ?? [], false),
    donors: uniqueActors(data?.donations ?? [], false),
  }
}

// ── Транзакции ─────────────────────────────────────────────────────────

export async function fetchTransactions(txids: readonly string[]): Promise<Transaction[]> {
  const ids = [...new Set(txids.filter(Boolean))]
  if (!ids.length) return []
  const raw = await rpc(rpcEndpoints.getTransactions, [ids])
  return unwrapRpcArray<Transaction>(raw)
}

/**
 * Монеты, приложенные к комментарию: выходы его транзакции не на адрес
 * автора. Нода считает так же — выходы автору поста (сдача уходит автору
 * комментария).
 */
export function commentCoins(tx: Transaction | undefined, author: string): number {
  if (!tx) return 0
  const sum = (tx.vout ?? [])
    .filter((o) => {
      const address = o.scriptPubKey?.addresses?.[0]
      return !!address && address !== author
    })
    .reduce((s, o) => s + (o.value || 0), 0)
  return pkoin(sum)
}

// ── Комментарий ────────────────────────────────────────────────────────

export async function fetchComment(postId: string, id: string): Promise<GetComment | null> {
  const raw = await rpc(rpcEndpoints.getComments, [postId, '', '', [id]])
  return unwrapRpcArray<GetComment>(raw).find((c) => c.id === id) ?? null
}

export interface CommentMessage {
  message: string
  url: string
  images: string[]
}

/** Текст комментария: нода отдаёт его JSON-строкой (`msg`). */
export function parseCommentMessage(msg: string | undefined): CommentMessage {
  try {
    const parsed = JSON.parse(msg || '{}') as Partial<CommentMessage>
    return {
      message: typeof parsed.message === 'string' ? parsed.message : '',
      url: typeof parsed.url === 'string' ? parsed.url : '',
      images: Array.isArray(parsed.images)
        ? parsed.images.filter((i) => typeof i === 'string')
        : [],
    }
  } catch {
    return { message: msg || '', url: '', images: [] }
  }
}

// ── Аккаунт ────────────────────────────────────────────────────────────

export interface ChainProfile {
  /** txid последнего изменения профиля. */
  hash?: string
  address: string
  name?: string
  i?: string
  l?: string
  postcnt?: number
  dltdcnt?: number
  reputation?: number
  subscribes_count?: number
  subscribers_count?: number
  blockings_count?: number
  blockers_count?: number
  likers_count?: number
  /** Ключи шифрования чата через запятую. */
  k?: string
  update?: number
  regdate?: number
  flags?: Record<string, unknown>
  bans?: Record<string, unknown>
  actions?: number
  badges?: string[]
  deleted?: boolean | string
}

export interface ChainUserState {
  trial?: boolean
  balance?: number
  user_reg_height?: number
  likers?: number
  badges?: string[]
}

export interface ChainRegistration {
  txid: string
  time: number
}

export interface ChainEarnings {
  lottery: number
  donation: number
  transfer: number
}

export interface ChainAccount {
  address: string
  profile: ChainProfile | null
  state: ChainUserState | null
  registration: ChainRegistration | null
  balance: number | null
}

/** Падение одного запроса не должно гасить весь аккаунт: адрес без профиля — норма. */
async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch {
    return null
  }
}

export async function fetchAccount(address: string): Promise<ChainAccount> {
  const [profileRaw, stateRaw, regRaw, infoRaw] = await Promise.all([
    settle(rpc(rpcEndpoints.getUserProfile, [[address], '1'])),
    settle(rpc(rpcEndpoints.getUserState, [address])),
    settle(rpc('getaddressregistration', [[address]])),
    rpc(rpcEndpoints.getAddressInfo, [address]),
  ])
  const profile = profileRaw ? (unwrapRpcArray<ChainProfile>(profileRaw)[0] ?? null) : null
  const state = stateRaw ? unwrapRpcResponse<ChainUserState>(stateRaw) : null
  const reg = regRaw ? unwrapRpcArray<Partial<ChainRegistration>>(regRaw)[0] : undefined
  const info = unwrapRpcResponse<{ balance?: number }>(infoRaw)
  return {
    address,
    profile: profile?.address ? profile : null,
    state: state && typeof state === 'object' ? state : null,
    registration: reg?.txid ? { txid: reg.txid, time: Number(reg.time) || 0 } : null,
    balance: typeof info?.balance === 'number' ? info.balance : null,
  }
}

/**
 * Заработок за всё время. Отдельно от аккаунта и одной попыткой: у адресов с
 * тысячами транзакций нода не успевает его посчитать («GetAccountEarning: sql
 * request timeout», 500), а перебор нод растянулся бы на минуты. Не вышло —
 * null, окно просто не покажет раздел.
 */
export async function fetchEarnings(address: string): Promise<ChainEarnings | null> {
  const raw = await settle(
    rpc(rpcEndpoints.getAccountEarning, [address, 0, 999_999_999], { noFailover: true })
  )
  const earn = raw
    ? unwrapRpcArray<{ amountLottery?: number; amountDonation?: number; amountTransfer?: number }>(
        raw
      )[0]
    : undefined
  if (!earn) return null
  return {
    lottery: pkoin((Number(earn.amountLottery) || 0) / SATOSHI),
    donation: pkoin((Number(earn.amountDonation) || 0) / SATOSHI),
    transfer: pkoin((Number(earn.amountTransfer) || 0) / SATOSHI),
  }
}

/** Сколько ключей чата опубликовано (0 — переписка с ним не шифруется). */
export function chatKeyCount(profile: Pick<ChainProfile, 'k'> | null): number {
  return (profile?.k ?? '').split(',').filter((k) => k.trim()).length
}

/** Сумма отметок модерации: нода пишет их как { причина: сколько }. */
export function flagCount(flags: Record<string, unknown> | undefined): number {
  return Object.values(flags ?? {}).reduce<number>((s, v) => s + (Number(v) || 0), 0)
}
