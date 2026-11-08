// Закреплённый пост профиля грузится по txid отдельно от ленты. Пост не
// автора профиля и удалённый не показываются; сменили закрепление — новый.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  byIds: vi.fn(),
  reposts: vi.fn(async () => {}),
  names: vi.fn(async () => {}),
}))

vi.mock('@/composables/helpers/feed-queries', () => ({ fetchRawPostsByIds: mocks.byIds }))
vi.mock('@/composables/helpers/feed-enrichment', () => ({
  fetchAndMergeRepostOriginals: mocks.reposts,
  preloadLastCommentAuthors: mocks.names,
}))

import { usePinnedPost } from './use-pinned-post'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)
const flush = () => new Promise((r) => setTimeout(r, 0))

function raw(txid: string, address = 'PAuthor') {
  return new Map([[txid, { txid, hash: txid, address, m: 'hello', time: 1, type: 'share' }]])
}

beforeEach(() => vi.clearAllMocks())

describe('usePinnedPost', () => {
  it('грузит закреплённый пост автора; сменили закрепление — грузит новый', async () => {
    mocks.byIds.mockResolvedValueOnce(raw(A)).mockResolvedValueOnce(raw(B))
    const pin = ref<string | undefined>(A)
    const post = usePinnedPost(
      () => 'PAuthor',
      () => pin.value
    )
    await flush()
    expect(post.value?.txid).toBe(A)
    expect(mocks.byIds).toHaveBeenCalledWith([A])

    pin.value = B
    await nextTick()
    await flush()
    expect(post.value?.txid).toBe(B)

    pin.value = ''
    await nextTick()
    expect(post.value).toBeNull()
  })

  it('чужой пост в настройках и удалённый пост не показываются', async () => {
    mocks.byIds.mockResolvedValueOnce(raw(A, 'PStranger')).mockResolvedValueOnce(new Map())
    const pin = ref<string | undefined>(A)
    const post = usePinnedPost(
      () => 'PAuthor',
      () => pin.value
    )
    await flush()
    expect(post.value).toBeNull()

    pin.value = B
    await nextTick()
    await flush()
    expect(post.value).toBeNull()
  })

  it('пока не знаем, что закреплено, — не грузим', async () => {
    const post = usePinnedPost(
      () => 'PAuthor',
      () => undefined
    )
    await flush()
    expect(post.value).toBeNull()
    expect(mocks.byIds).not.toHaveBeenCalled()
  })
})
