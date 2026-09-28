/**
 * Опросы в постах: голоса, которые сеть ещё не подтвердила, и сколько под
 * постом комментариев-голосов — их нет в обсуждении, и счётчик комментариев
 * их не считает. Формат опроса и голоса — helpers/content/poll.ts.
 *
 * Неподтверждённый голос хранится в localStorage: после перезагрузки опрос
 * по-прежнему показывает «ваш голос», пока его комментарий не придёт с ноды.
 * Не пришёл за 30 минут — транзакция, видимо, не прошла, и голосовать можно снова.
 */

import { defineStore } from 'pinia'

const STORAGE_KEY = 'bastyon_poll_votes_pending'
export const PENDING_VOTE_TTL_MS = 30 * 60 * 1000

export interface PendingVote {
  vote: number
  txid: string
  /** Когда отправлен, мс. */
  at: number
}

type PendingMap = Record<string, PendingVote>

const key = (address: string, postId: string): string => `${address}:${postId}`

function fresh(map: PendingMap, now = Date.now()): PendingMap {
  return Object.fromEntries(
    Object.entries(map).filter(([, v]) => now - v.at < PENDING_VOTE_TTL_MS)
  ) as PendingMap
}

function read(): PendingMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    const out: PendingMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const p = v as Partial<PendingVote>
      if (Number.isInteger(p?.vote) && typeof p?.txid === 'string' && typeof p?.at === 'number') {
        out[k] = { vote: p.vote as number, txid: p.txid, at: p.at }
      }
    }
    return fresh(out)
  } catch {
    return {}
  }
}

function persist(map: PendingMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Приватный режим: голос просто не переживёт перезагрузку.
  }
}

export const usePollVotesStore = defineStore('poll-votes', {
  state: () => ({
    pending: read(),
    /** postId → сколько корневых комментариев под постом — голоса. */
    voteComments: {} as Record<string, number>,
  }),

  getters: {
    pendingFor:
      (state) =>
      (address: string, postId: string): PendingVote | null => {
        const vote = state.pending[key(address, postId)]
        return vote && Date.now() - vote.at < PENDING_VOTE_TTL_MS ? vote : null
      },
    voteCommentsFor:
      (state) =>
      (postId: string): number =>
        state.voteComments[postId] ?? 0,
  },

  actions: {
    addPending(address: string, postId: string, vote: number, txid: string): void {
      this.pending = {
        ...fresh(this.pending),
        [key(address, postId)]: { vote, txid, at: Date.now() },
      }
      persist(this.pending)
    },

    removePending(address: string, postId: string): void {
      const k = key(address, postId)
      if (!(k in this.pending)) return
      const next = { ...this.pending }
      delete next[k]
      this.pending = next
      persist(next)
    },

    setVoteComments(postId: string, count: number): void {
      if (this.voteComments[postId] !== count) this.voteComments[postId] = count
    },
  },
})
