// «Последние комментарии»: getlastcomments [20, '', язык интерфейса]; имена
// авторов и адресатов догружаются до показа списка; список обновляется раз в
// минуту — нода отдаёт только свежие 10 и листать назад не умеет, поэтому
// «подгрузка» здесь — это новые комментарии. Адресат — автор комментария, на
// который ответили, иначе автор ветки, иначе автор поста.

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const mocks = vi.hoisted(() => ({ getByPRC: vi.fn(), getByPRCWithAuth: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({
  getByPRC: mocks.getByPRC,
  getByPRCWithAuth: mocks.getByPRCWithAuth,
}))

import { i18n } from '@/i18n'
import { __resetUserNamesForTests, userName } from '@/services/user-names'
import type { GetLastComment } from '@/types/rpc-responses/get-last-comments'
import {
  LAST_COMMENTS_REFRESH_MS,
  lastCommentRecipient,
  useLastComments,
} from './use-comments-queries'

const ALICE = 'PFGJoLTrDwDutGs2L4Bo6aZzFiq6BHHxrW'
const BOB = 'PB7SLqrq2NLPskpeFs7THh9LPEm2Egjvyp'
const CAROL = 'PGy9ePEwWkX4AQLKwfkQeoaqWTtmR8CoBf'

function comment(overrides: Partial<GetLastComment>): GetLastComment {
  return {
    id: 'c1',
    postid: 'post1',
    address: ALICE,
    msg: JSON.stringify({ message: 'Привет', url: '', images: [], info: '' }),
    parentid: '',
    answerid: '',
    addressContent: BOB,
    addressCommentParent: '',
    addressCommentAnswer: '',
    scoreUp: 0,
    scoreDown: 0,
    edit: false,
    ...overrides,
  }
}

const mounted: Array<{ unmount: () => void }> = []

function withComposable<T>(fn: () => T): T {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let api!: T
  const harness = defineComponent({
    setup() {
      api = fn()
      return () => h('div')
    },
  })
  mounted.push(mount(harness, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }))
  return api
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.getByPRC.mockReset()
  __resetUserNamesForTests()
})

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  __resetUserNamesForTests()
  vi.useRealTimers()
})

describe('lastCommentRecipient', () => {
  it('ответ — автору комментария, иначе ветки, иначе поста', () => {
    expect(lastCommentRecipient(comment({ addressCommentAnswer: CAROL }))).toBe(CAROL)
    expect(lastCommentRecipient(comment({ addressCommentParent: CAROL }))).toBe(CAROL)
    expect(lastCommentRecipient(comment({}))).toBe(BOB)
  })

  it('себе — никому: ответ на свой комментарий к своему посту', () => {
    expect(
      lastCommentRecipient(
        comment({ addressContent: ALICE, addressCommentParent: ALICE, addressCommentAnswer: ALICE })
      )
    ).toBe('')
  })
})

describe('useLastComments', () => {
  it('список показывается уже с именами и обновляется раз в минуту', async () => {
    let round = 0
    mocks.getByPRC.mockImplementation(async (p: { method: string; parameters: unknown[] }) => {
      if (p.method === 'getlastcomments') {
        round += 1
        return { result: 'success', data: [comment({ id: `c${round}` })] }
      }
      if (p.method === 'getuserprofile') {
        // Имена идут дольше списка: список не должен появиться раньше них.
        await new Promise((resolve) => setTimeout(resolve, 500))
        return {
          result: 'success',
          data: [
            { address: ALICE, name: 'lic' },
            { address: BOB, name: 'Ivin1962' },
          ],
        }
      }
      throw new Error(`unexpected ${p.method}`)
    })

    const query = withComposable(() => useLastComments(true))
    await vi.advanceTimersByTimeAsync(100)
    expect(query.data.value).toBeUndefined()

    await vi.advanceTimersByTimeAsync(500)
    expect(query.data.value?.data?.[0]?.id).toBe('c1')
    expect(userName(ALICE)).toBe('lic')
    expect(userName(BOB)).toBe('Ivin1962')

    const calls = mocks.getByPRC.mock.calls.map(
      (c) => c[0] as { method: string; parameters: unknown[] }
    )
    expect(calls[0]).toMatchObject({
      method: 'getlastcomments',
      parameters: ['20', '', String(i18n.global.locale.value)],
      options: { auth: false },
    })
    expect(calls[1]).toMatchObject({ method: 'getuserprofile', parameters: [[ALICE, BOB], '1'] })

    await vi.advanceTimersByTimeAsync(LAST_COMMENTS_REFRESH_MS)
    expect(round).toBe(2)
    expect(query.data.value?.data?.[0]?.id).toBe('c2')
    // Имена уже известны — повторно их не спрашивают.
    expect(mocks.getByPRC.mock.calls.filter((c) => c[0].method === 'getuserprofile')).toHaveLength(
      1
    )
  })
})
