// Блок «Последние комментарии» справа: ники вместо адресов, один комментарий
// на автора (как в старом клиенте — иначе серия «👍» одного человека занимала
// весь блок), свежий список показывается без перезагрузки, а клик по
// комментарию к посту не из ленты ведёт на страницу поста к этому комментарию.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref, shallowRef } from 'vue'

const mocks = vi.hoisted(() => ({
  getByPRC: vi.fn(),
  push: vi.fn(),
  openPostModal: vi.fn(),
  cachedPosts: {} as Record<string, unknown>,
  data: null as unknown as { value: unknown },
  isLoading: null as unknown as { value: boolean },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  i18n: { global: { locale: { value: 'ru' } } },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC, getByPRCWithAuth: vi.fn() }))
vi.mock('@/stores/modal-store', () => ({
  useModalStore: () => ({ openPostModal: mocks.openPostModal }),
}))
vi.mock('@/stores/posts-store', () => ({
  usePostsStore: () => ({ getPostByShareId: (id: string) => mocks.cachedPosts[id] }),
}))
vi.mock('@/composables/use-comments-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/composables/use-comments-queries')>()),
  useLastComments: () => ({ data: mocks.data, isLoading: mocks.isLoading }),
}))

import { __resetUserNamesForTests, rememberUsers, shortAddress } from '@/services/user-names'
import type { GetLastComment } from '@/types/rpc-responses/get-last-comments'
import LastComments from './last-comments.vue'

const ALICE = 'PFGJoLTrDwDutGs2L4Bo6aZzFiq6BHHxrW'
const BOB = 'PB7SLqrq2NLPskpeFs7THh9LPEm2Egjvyp'
const CAROL = 'PGy9ePEwWkX4AQLKwfkQeoaqWTtmR8CoBf'

function comment(
  id: string,
  address: string,
  text: string,
  extra: Partial<GetLastComment> = {}
): GetLastComment {
  return {
    id,
    postid: `post-${id}`,
    address,
    msg: JSON.stringify({ message: text, url: '', images: [], info: '' }),
    parentid: '',
    answerid: '',
    addressContent: BOB,
    addressCommentParent: '',
    addressCommentAnswer: '',
    scoreUp: 0,
    scoreDown: 0,
    edit: false,
    ...extra,
  }
}

function show(...comments: GetLastComment[]): void {
  mocks.data.value = { result: 'success', data: comments }
}

/** Строки списка: корень блока — заголовок и список. */
function rows(w: VueWrapper): HTMLElement[] {
  const list = w.element.children[1] as HTMLElement | undefined
  return list ? ([...list.children] as HTMLElement[]) : []
}

function rowWith(w: VueWrapper, text: string): HTMLElement {
  const row = rows(w).find((el) => el.textContent?.includes(text))
  if (!row) throw new Error(`no row with «${text}»`)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetUserNamesForTests()
  mocks.cachedPosts = {}
  mocks.data = shallowRef<unknown>(undefined)
  mocks.isLoading = ref(false)
  mocks.getByPRC.mockResolvedValue({ result: 'success', data: [] })
})

afterEach(() => {
  vi.useRealTimers()
  __resetUserNamesForTests()
})

describe('LastComments', () => {
  it('ники авторов и адресатов, один комментарий на автора, пустые пропускаются', () => {
    rememberUsers([
      { address: ALICE, name: 'lic', i: 'https://x/alice.jpg' },
      { address: BOB, name: 'Ivin1962' },
      { address: CAROL, name: 'Svet29lana' },
    ])
    show(
      comment('c1', ALICE, '👍'),
      comment('c2', ALICE, '👍'),
      comment('c3', CAROL, ''),
      comment('c4', CAROL, 'Я тоже из того племени', { addressCommentAnswer: ALICE }),
      comment('c5', BOB, 'Себе под пост', { addressContent: BOB })
    )
    const w = mount(LastComments)

    expect(rows(w)).toHaveLength(3)
    expect(rowWith(w, '👍').textContent).toContain('lic → Ivin1962 : 👍')
    expect(rowWith(w, 'племени').textContent).toContain('Svet29lana → lic : Я тоже из того племени')
    expect(rowWith(w, 'Себе').textContent).toContain('Ivin1962 → — : Себе под пост')
    expect(w.text()).not.toContain(shortAddress(ALICE))
    expect(rowWith(w, '👍').querySelector('img')?.getAttribute('src')).toBe('https://x/alice.jpg')
  })

  it('свежий список появляется без перезагрузки', async () => {
    rememberUsers([
      { address: ALICE, name: 'lic' },
      { address: BOB, name: 'Ivin1962' },
      { address: CAROL, name: 'Svet29lana' },
    ])
    show(comment('c1', ALICE, 'Первый'))
    const w = mount(LastComments)
    expect(rows(w)).toHaveLength(1)

    show(comment('c2', CAROL, 'Новый'), comment('c1', ALICE, 'Первый'))
    await flushPromises()
    expect(rows(w)).toHaveLength(2)
    expect(rows(w)[0]?.textContent).toContain('Svet29lana → Ivin1962 : Новый')
  })

  it('имя, которого ещё нет, догружается и сменяет адрес', async () => {
    vi.useFakeTimers()
    mocks.getByPRC.mockResolvedValue({
      result: 'success',
      data: [
        { address: CAROL, name: 'Svet29lana' },
        { address: BOB, name: 'Ivin1962' },
      ],
    })
    show(comment('c1', CAROL, 'Привет'))
    const w = mount(LastComments)
    expect(w.text()).toContain(shortAddress(CAROL))

    await vi.advanceTimersByTimeAsync(50)
    expect(rowWith(w, 'Привет').textContent).toContain('Svet29lana → Ivin1962 : Привет')
  })

  it('клик: пост из ленты — в окне, иначе страница поста с переходом к комментарию', async () => {
    rememberUsers([
      { address: ALICE, name: 'lic' },
      { address: BOB, name: 'Ivin1962' },
      { address: CAROL, name: 'Svet29lana' },
    ])
    mocks.cachedPosts['post-c1'] = { id: 'post-c1' }
    show(
      comment('c1', ALICE, 'Из ленты'),
      comment('c2', CAROL, 'Ответ', { parentid: 'root1', answerid: 'root1' }),
      comment('c3', BOB, 'Корневой')
    )
    const w = mount(LastComments)

    rowWith(w, 'Из ленты').click()
    expect(mocks.openPostModal).toHaveBeenCalledWith({ id: 'post-c1' })
    expect(mocks.push).not.toHaveBeenCalled()

    rowWith(w, 'Ответ').click()
    expect(mocks.push).toHaveBeenLastCalledWith({
      name: 'post',
      params: { txid: 'post-c2' },
      query: { commentid: 'c2', parentid: 'root1' },
    })

    rowWith(w, 'Корневой').click()
    expect(mocks.push).toHaveBeenLastCalledWith({
      name: 'post',
      params: { txid: 'post-c3' },
      query: { commentid: 'c3' },
    })
  })
})
