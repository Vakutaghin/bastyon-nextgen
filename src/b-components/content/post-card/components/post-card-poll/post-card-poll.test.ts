import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

import { i18n } from '@/i18n'
import { voteCommentBody } from '@/helpers/content/poll'
import type { GetComment } from '@/types/rpc-responses/get-comments'

const auth = reactive({ isUserAuthenticated: true, getUserAddress: 'PMe' })
const node = vi.hoisted(() => ({ comments: [] as unknown[], sent: vi.fn() }))

vi.mock('@/blockchain', () => ({ useAuthStore: () => auth }))
vi.mock('../post-card-comments/helpers/fetch-comments', () => ({
  fetchComments: async () => node.comments,
}))
vi.mock('../post-card-comments/comment-sender', () => ({
  sendPollVote: (...args: unknown[]) => node.sent(...args),
}))

import PostCardPoll from './post-card-poll.vue'
import { buildSortedComments } from '../post-card-comments/helpers/comments-computed'

const POLL = { title: 'Куда едем?', options: ['Море', 'Горы'] }

const vote = (address: string, index: number) =>
  ({
    address,
    time: 1,
    timeUpd: 1,
    deleted: false,
    msg: JSON.stringify(voteCommentBody(index, POLL.options[index] ?? '')),
  }) as GetComment

function render() {
  return mount(PostCardPoll, {
    props: { postId: 'post1', poll: POLL },
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

describe('PostCardPoll', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    i18n.global.locale.value = 'ru'
    auth.isUserAuthenticated = true
    node.comments = [vote('PAlice', 1), vote('PBob', 1), vote('PCarol', 0)]
    node.sent.mockReset()
  })

  it('до своего голоса — варианты-кнопки, итогов не видно', async () => {
    const w = render()
    await flushPromises()
    expect(w.text()).toContain('Куда едем?')
    expect(w.text()).toContain('3 голоса')
    expect(w.text()).not.toContain('%')
    expect(w.findAll('button').every((b) => b.attributes('disabled') === undefined)).toBe(true)
    w.unmount()
  })

  it('голос уходит комментарием, вариант отмечен, итоги с ним', async () => {
    node.sent.mockResolvedValue('txVote')
    const w = render()
    await flushPromises()
    await w.findAll('button')[0]!.trigger('click')
    await flushPromises()
    expect(node.sent).toHaveBeenCalledWith('post1', 0, 'Море')
    expect(w.findAll('button')[0]!.attributes('aria-pressed')).toBe('true')
    // 2 за «Море» (Carol и я) из 4.
    expect(w.text()).toContain('50%')
    expect(w.text()).toContain('4 голоса')
    expect(w.text()).toContain('ждёт подтверждения сети')
    w.unmount()
  })

  it('уже голосовал — сразу итоги и свой вариант', async () => {
    node.comments = [...node.comments, vote('PMe', 1)]
    const w = render()
    await flushPromises()
    expect(w.findAll('button')[1]!.attributes('aria-pressed')).toBe('true')
    expect(w.text()).toContain('75%')
    expect(node.sent).not.toHaveBeenCalled()
    w.unmount()
  })

  it('гость видит итоги, голосовать не может', async () => {
    auth.isUserAuthenticated = false
    const w = render()
    await flushPromises()
    expect(w.text()).toContain('67%')
    await w.findAll('button')[0]!.trigger('click')
    expect(node.sent).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('обсуждение без голосов', () => {
  it('голоса-комментарии не попадают в список', () => {
    const text = { ...vote('PDan', 0), msg: JSON.stringify({ message: 'Горы лучше', info: '' }) }
    const sorted = buildSortedComments(
      [vote('PAlice', 1), text as GetComment],
      [],
      'newest',
      'PMe',
      'PAuthor'
    )
    expect(sorted).toHaveLength(1)
    expect(sorted[0]!.address).toBe('PDan')
  })
})
