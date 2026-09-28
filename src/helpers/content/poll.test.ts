import { describe, expect, it } from 'vitest'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { isVoteComment, parsePoll, parseVote, tallyVotes, voteCommentBody } from './poll'

function comment(address: string, msg: string, time: number, extra: Partial<GetComment> = {}) {
  return { address, msg, time, timeUpd: time, deleted: false, ...extra } as GetComment
}

const vote = (address: string, index: number, time: number, extra: Partial<GetComment> = {}) =>
  comment(address, JSON.stringify(voteCommentBody(index, `вариант ${index}`)), time, extra)

describe('parsePoll', () => {
  it('вопрос и от 2 до 5 непустых вариантов', () => {
    expect(parsePoll({ title: ' Куда едем? ', list: ['Море', ' ', 'Горы'] })).toEqual({
      title: 'Куда едем?',
      options: ['Море', 'Горы'],
    })
    expect(parsePoll({ title: 'Q', list: ['a', 'b', 'c', 'd', 'e', 'f'] })?.options).toHaveLength(5)
  })

  it('неполный или чужой формат — опроса нет', () => {
    expect(parsePoll(undefined)).toBeNull()
    expect(parsePoll({})).toBeNull()
    expect(parsePoll({ title: '', list: ['a', 'b'] })).toBeNull()
    expect(parsePoll({ title: 'Q', list: ['a'] })).toBeNull()
    expect(parsePoll({ title: 'Q', list: 'a,b' })).toBeNull()
    expect(parsePoll({ title: 'Q', list: [1, 2] })).toBeNull()
  })
})

describe('голос комментарием', () => {
  it('текст читается в старом клиенте, номер — в info', () => {
    const body = voteCommentBody(1, 'Горы')
    expect(body).toEqual({ message: '🗳 Горы', url: '', images: [], info: '{"poll":1}' })
    expect(parseVote(JSON.stringify(body))).toBe(1)
  })

  it('обычные и испорченные комментарии — не голоса', () => {
    const plain = JSON.stringify({ message: 'poll', url: '', images: [], info: '' })
    expect(parseVote(plain)).toBeNull()
    expect(parseVote('не json')).toBeNull()
    expect(parseVote(JSON.stringify({ message: '', info: '{"poll":-1}' }))).toBeNull()
    expect(parseVote(JSON.stringify({ message: '', info: '{"poll":1.5}' }))).toBeNull()
    expect(parseVote(JSON.stringify({ message: '', info: 'poll' }))).toBeNull()
    expect(isVoteComment({ msg: plain })).toBe(false)
    expect(isVoteComment({ msg: JSON.stringify(voteCommentBody(0, 'a')) })).toBe(true)
  })
})

describe('tallyVotes', () => {
  it('один голос на адрес — последний; удалённые и чужие номера не считаются', () => {
    const tally = tallyVotes(
      [
        vote('alice', 0, 100),
        vote('alice', 1, 200), // передумала
        vote('bob', 1, 150),
        vote('carol', 0, 120, { deleted: true }),
        vote('dave', 7, 130), // варианта 7 нет
        comment('erin', JSON.stringify({ message: 'просто мнение', info: '' }), 110),
      ],
      2
    )
    expect(tally.counts).toEqual([0, 2])
    expect(tally.total).toBe(2)
    expect(tally.byAddress.get('alice')).toBe(1)
    expect(tally.byAddress.has('carol')).toBe(false)
    // Все пять голосов-комментариев в обсуждении не показываются, мнение — показывается.
    expect(tally.voteComments).toBe(5)
  })

  it('пусто — нули', () => {
    expect(tallyVotes([], 3)).toMatchObject({ counts: [0, 0, 0], total: 0, voteComments: 0 })
  })
})
