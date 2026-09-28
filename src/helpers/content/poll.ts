// Опросы в постах. В протоколе Bastyon голосования нет, а нода не хранит
// поле опроса `p`, которое заполнял старый клиент: у поста она разбирает только
// l, c, m, u, s, t, i (pocketnet.core, Post.cpp). Поэтому:
//
// - опрос лежит в настройках поста: `s.poll = { title, list }` — настройки нода
//   хранит целиком, а в хеш поста они не входят;
// - голос — корневой комментарий к посту: `info` = `{"poll": номер варианта}`,
//   текст — «🗳 вариант», чтобы в старом клиенте голос читался как комментарий.
//   Голос каждого адреса — его последний такой комментарий; удалил — голоса нет.
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { CommentMessageBody } from '@/types/rpc-requests/send-raw-transaction-with-message'

export interface PostPoll {
  title: string
  options: string[]
}

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 5
/** Длиннее — обрезаем при показе: данные из сети, их писал кто угодно. */
const MAX_TITLE = 300
const MAX_OPTION = 200

/** Метка голоса в тексте комментария. */
const VOTE_MARK = '🗳'

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Опрос из `s.poll` поста; null — опроса нет или он неполный. */
export function parsePoll(raw: unknown): PostPoll | null {
  if (!raw || typeof raw !== 'object') return null
  const { title, list } = raw as { title?: unknown; list?: unknown }
  if (!Array.isArray(list)) return null
  const options = list.map((o) => text(o, MAX_OPTION)).filter(Boolean)
  const question = text(title, MAX_TITLE)
  if (!question || options.length < POLL_MIN_OPTIONS) return null
  return { title: question, options: options.slice(0, POLL_MAX_OPTIONS) }
}

/** Тело комментария-голоса за вариант `index`. */
export function voteCommentBody(index: number, option: string): CommentMessageBody {
  return {
    message: `${VOTE_MARK} ${option}`,
    url: '',
    images: [],
    info: JSON.stringify({ poll: index }),
  }
}

/** Номер варианта из текста комментария (`msg`); null — это не голос. */
export function parseVote(msg: string | undefined): number | null {
  if (!msg) return null
  let info: unknown
  try {
    info = (JSON.parse(msg) as { info?: unknown }).info
  } catch {
    return null
  }
  if (typeof info !== 'string' || !info.includes('poll')) return null
  try {
    const vote = (JSON.parse(info) as { poll?: unknown }).poll
    return Number.isInteger(vote) && (vote as number) >= 0 ? (vote as number) : null
  } catch {
    return null
  }
}

export interface PollTally {
  /** Голосов за каждый вариант. */
  counts: number[]
  total: number
  /** Голос каждого адреса — номер варианта. */
  byAddress: Map<string, number>
  /** Комментариев-голосов среди корневых: их не показываем в обсуждении. */
  voteComments: number
}

/** Итоги опроса по корневым комментариям поста. */
export function tallyVotes(comments: readonly GetComment[], optionsCount: number): PollTally {
  const latest = new Map<string, { vote: number; at: number }>()
  let voteComments = 0
  for (const c of comments) {
    const vote = parseVote(c.msg)
    if (vote === null) continue
    voteComments++
    if (c.deleted || vote >= optionsCount || !c.address) continue
    const at = Number(c.timeUpd || c.time || 0)
    const prev = latest.get(c.address)
    if (!prev || at >= prev.at) latest.set(c.address, { vote, at })
  }
  const counts = Array.from({ length: optionsCount }, () => 0)
  const byAddress = new Map<string, number>()
  for (const [address, { vote }] of latest) {
    counts[vote] = (counts[vote] ?? 0) + 1
    byAddress.set(address, vote)
  }
  return { counts, total: byAddress.size, byAddress, voteComments }
}

/** Комментарий — голос в опросе: в обсуждении его не показываем. */
export function isVoteComment(comment: Pick<GetComment, 'msg'>): boolean {
  return parseVote(comment.msg) !== null
}
