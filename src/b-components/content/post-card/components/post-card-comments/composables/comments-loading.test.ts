// Загрузка обсуждения и веток: первая страница, «ещё» и «все», таймаут
// с понятной ошибкой, сверка локальных меток со свежим списком, ответы
// по требованию со своими неподтверждёнными (без дублей с серверными),
// скрытие по блок-листу и репутации с «Показать всё равно» и обновление
// по событиям WebSocket с дебаунсом. comments-store — настоящий.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { GetComment } from '@/types/rpc-responses/get-comments'

const mocks = vi.hoisted(() => ({
  fetchComments: vi.fn(),
  relations: { blockedSet: new Set<string>() },
  auth: { getUserProfile: { name: 'Я', i: 'https://img/me.jpg' } as unknown },
  wsHandler: null as null | ((data: Record<string, unknown>) => void),
  wsUnsub: vi.fn(),
}))
vi.mock('../helpers/fetch-comments', () => ({ fetchComments: mocks.fetchComments }))
vi.mock('@/stores', async () => {
  const { useCommentsStore } = await import('@/stores/comments-store')
  return { useCommentsStore, useUserRelationsStore: () => mocks.relations }
})
vi.mock('@/stores/app-preferences-store', () => ({
  useAppPreferencesStore: () => ({ commentsOrder: 'newest' }),
}))
vi.mock('@/blockchain', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/blockchain/ws/ws-service', () => ({
  wsService: {
    on: (_event: string, handler: (data: Record<string, unknown>) => void) => {
      mocks.wsHandler = handler
      return mocks.wsUnsub
    },
  },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key, tn: (key: string) => key }))

import { useCommentsStore } from '@/stores/comments-store'
import { COMMENT_LOAD_TIMEOUT_MS, COMMENTS_ALREADY_SHOWN, COMMENTS_PAGE_SIZE } from '../consts'
import { useCommentsLoader } from './use-comments-loader'
import { useCommentsReplies } from './use-comments-replies'
import { useCommentVisibility } from './use-comment-visibility'
import { useCommentsWs } from './use-comments-ws'

const make = (id: string, overrides: Partial<GetComment> = {}) =>
  ({ id, postid: 'post1', address: 'PAuthor', msg: '{"message":"x"}', ...overrides }) as GetComment

const many = (n: number) => Array.from({ length: n }, (_, i) => make(`c${i}`))

describe('обсуждение под постом', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.fetchComments.mockReset()
    mocks.relations.blockedSet = new Set()
    mocks.wsHandler = null
    mocks.wsUnsub.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useCommentsLoader', () => {
    it('порядок — из настроек; первая страница, «ещё» по странице, «все» разом', async () => {
      const list = many(40)
      mocks.fetchComments.mockResolvedValue(list)
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => list.length })
      expect(loader.commentsSortOrder.value).toBe('newest')

      await loader.loadAllComments()
      expect(mocks.fetchComments).toHaveBeenCalledWith('post1', '', expect.any(String))
      const first = COMMENTS_ALREADY_SHOWN + COMMENTS_PAGE_SIZE
      expect(loader.visibleCommentsCount.value).toBe(first)

      loader.showMoreComments()
      expect(loader.visibleCommentsCount.value).toBe(first + COMMENTS_PAGE_SIZE)
      loader.showAllComments()
      expect(loader.visibleCommentsCount.value).toBe(40)
      loader.showMoreComments()
      expect(loader.visibleCommentsCount.value).toBe(40)
    })

    it('свежеотправленный комментарий виден и при пустом ответе ноды', async () => {
      mocks.fetchComments.mockResolvedValue([])
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => 1 })
      await loader.loadAllComments()
      expect(loader.visibleCommentsCount.value).toBe(1)
    })

    it('сверка со свежим списком снимает локальную метку удаления', async () => {
      const store = useCommentsStore()
      store.markDeleted('c1')
      mocks.fetchComments.mockResolvedValue([make('c1', { deleted: true } as Partial<GetComment>)])
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => 1 })
      await loader.loadAllComments()
      expect(store.deletedCommentIds.c1).toBeUndefined()
    })

    it('нода молчит дольше таймаута — понятная ошибка, спиннер снят', async () => {
      vi.useFakeTimers()
      mocks.fetchComments.mockReturnValue(new Promise(() => {}))
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => 0 })
      const pending = loader.loadAllComments()
      expect(loader.allCommentsLoading.value).toBe(true)
      await vi.advanceTimersByTimeAsync(COMMENT_LOAD_TIMEOUT_MS)
      await pending
      expect(loader.allCommentsError.value?.message).toBe('commentsMsg.loadTimeout')
      expect(loader.allCommentsLoading.value).toBe(false)
    })

    it('пока загрузка идёт, второй запрос не уходит; без поста — ни одного', async () => {
      let finish!: (list: GetComment[]) => void
      mocks.fetchComments.mockReturnValue(new Promise((resolve) => (finish = resolve)))
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => 0 })
      const first = loader.loadAllComments()
      await loader.loadAllComments()
      expect(mocks.fetchComments).toHaveBeenCalledTimes(1)
      finish([])
      await first

      await useCommentsLoader({ postId: ref(''), getSortedLength: () => 0 }).loadAllComments()
      expect(mocks.fetchComments).toHaveBeenCalledTimes(1)
    })

    it('порядок меняется только на известные значения; блок сворачивается и разворачивается', () => {
      const loader = useCommentsLoader({ postId: ref('post1'), getSortedLength: () => 0 })
      loader.setCommentsSortOrder('oldest')
      loader.setCommentsSortOrder('random')
      expect(loader.commentsSortOrder.value).toBe('oldest')
      loader.collapseComments()
      expect(loader.commentsCollapsed.value).toBe(true)
      loader.expandComments()
      expect(loader.commentsCollapsed.value).toBe(false)
    })
  })

  describe('useCommentsReplies', () => {
    it('первый клик грузит ветку, следующие сворачивают и разворачивают без запроса', async () => {
      mocks.fetchComments.mockResolvedValue([make('r1', { parentid: 'c1' })])
      const replies = useCommentsReplies({ postId: ref('post1') })
      replies.onRepliesClick(make('c1'))
      expect(replies.isRepliesLoading('c1')).toBe(true)
      await vi.waitFor(() => expect(replies.isRepliesLoading('c1')).toBe(false))

      expect(mocks.fetchComments).toHaveBeenCalledWith('post1', 'c1', expect.stringContaining('c1'))
      expect(replies.getReplies('c1').map((c) => c.id)).toEqual(['r1'])
      expect(replies.isRepliesExpanded('c1')).toBe(true)

      replies.onRepliesClick(make('c1'))
      expect(replies.isRepliesExpanded('c1')).toBe(false)
      expect(mocks.fetchComments).toHaveBeenCalledTimes(1)
    })

    it('свой неподтверждённый ответ виден в ветке и не дублирует подтверждённый', async () => {
      const store = useCommentsStore()
      store.addPending({
        id: 'tx-pending',
        postId: 'post1',
        message: 'мой ответ',
        parentId: 'c1',
        answerId: 'c1',
        address: 'PMe',
        createdAt: Date.now(),
      } as never)
      mocks.fetchComments.mockResolvedValue([make('r1', { parentid: 'c1' })])
      const replies = useCommentsReplies({ postId: ref('post1') })
      await replies.loadReplies('c1')

      const branch = replies.getReplies('c1')
      expect(branch.map((c) => c.id)).toEqual(['r1', 'tx-pending'])
      expect(branch[1]).toMatchObject({ temp: true, address: 'PMe', parentid: 'c1' })
      expect(JSON.parse(branch[1]!.msg).message).toBe('мой ответ')
      expect(branch[1]!.userprofile?.name).toBe('Я')

      mocks.fetchComments.mockResolvedValue([make('r1'), make('tx-pending')])
      await replies.loadReplies('c1')
      expect(replies.getReplies('c1').map((c) => c.id)).toEqual(['r1', 'tx-pending'])
    })

    it('ошибка загрузки ветки — пустая ветка, без исключения', async () => {
      mocks.fetchComments.mockRejectedValue(new Error('offline'))
      const replies = useCommentsReplies({ postId: ref('post1') })
      await replies.loadReplies('c1')
      expect(replies.getReplies('c1')).toEqual([])
      expect(replies.isRepliesLoading('c1')).toBe(false)
    })
  })

  describe('useCommentVisibility', () => {
    const lowRep = (id: string, address = 'PBad') =>
      make(id, {
        address,
        scoreDown: 6,
        userprofile: { reputation: -1 },
      } as unknown as Partial<GetComment>)

    it('заблокированный автор и низкая репутация скрывают, причина — для баннера', () => {
      mocks.relations.blockedSet = new Set(['PBlocked'])
      const v = useCommentVisibility({ currentUserAddress: ref('PMe'), isDeleted: () => false })
      expect(v.hiddenReason(make('c1', { address: 'PBlocked' }))).toBe('blocked')
      expect(v.hiddenReason(lowRep('c2'))).toBe('reputation')
      expect(v.hiddenReason(make('c3'))).toBeNull()
      expect(v.shouldHideContent(lowRep('c2'))).toBe(true)
    })

    it('«Показать всё равно» раскрывает; удалённый и свой не прячутся', () => {
      const deleted = new Set(['c9'])
      const v = useCommentVisibility({
        currentUserAddress: ref('PMe'),
        isDeleted: (c) => deleted.has(c.id),
      })
      v.revealHiddenComment(lowRep('c2'))
      expect(v.shouldHideContent(lowRep('c2'))).toBe(false)
      expect(v.shouldHideContent(lowRep('c9'))).toBe(false)
      expect(v.shouldHideContent(lowRep('c4', 'PMe'))).toBe(false)
      expect(v.isMyComment(make('c5', { address: 'PMe' }))).toBe(true)
      expect(v.isMyComment(make('c6'))).toBe(false)
    })
  })

  describe('useCommentsWs', () => {
    function mountWs(opts: { hasLoaded?: boolean; collapsed?: boolean } = {}) {
      const reload = vi.fn()
      const isLoading = ref(false)
      let api!: ReturnType<typeof useCommentsWs>
      const wrapper = mount(
        defineComponent({
          setup() {
            api = useCommentsWs({
              postId: ref('post1'),
              isLoading,
              hasLoaded: ref(opts.hasLoaded ?? true),
              isCollapsed: ref(opts.collapsed ?? false),
              reload,
            })
            return () => h('div')
          },
        })
      )
      return { wrapper, reload, isLoading, api: () => api }
    }

    it('пачка событий о комментариях — одно обновление через 600 мс', async () => {
      vi.useFakeTimers()
      const { reload } = mountWs()
      mocks.wsHandler!({ type: 'comment', txid: 'a' })
      mocks.wsHandler!({ type: 'cScore', txid: 'b' })
      mocks.wsHandler!({ type: 'commentDelete', txid: 'c' })
      expect(reload).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(600)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('подтверждение своей транзакции ловится по txid, даже если type — mesType (S19)', async () => {
      vi.useFakeTimers()
      const store = useCommentsStore()
      const spy = vi.spyOn(store, 'applyConfirmedTx')
      vi.spyOn(store, 'hasPendingTx').mockImplementation((_p, txid) => txid === 'tx-mine')
      const { reload } = mountWs()
      mocks.wsHandler!({ type: 'answer', txid: 'tx-mine' })
      expect(spy).toHaveBeenCalledWith('post1', 'tx-mine', 'answer')
      await vi.advanceTimersByTimeAsync(600)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('свёрнутое или ни разу не открытое обсуждение не перезагружается', async () => {
      vi.useFakeTimers()
      const collapsed = mountWs({ collapsed: true })
      mocks.wsHandler!({ type: 'comment', txid: 'a' })
      await vi.advanceTimersByTimeAsync(600)
      expect(collapsed.reload).not.toHaveBeenCalled()
      collapsed.wrapper.unmount()

      const unopened = mountWs({ hasLoaded: false })
      mocks.wsHandler!({ type: 'comment', txid: 'a' })
      await vi.advanceTimersByTimeAsync(600)
      expect(unopened.reload).not.toHaveBeenCalled()
    })

    it('посторонние события игнорируются; размонтирование отписывает', async () => {
      vi.useFakeTimers()
      const { wrapper, reload } = mountWs()
      mocks.wsHandler!({ type: 'share', txid: 'x' })
      mocks.wsHandler!({})
      await vi.advanceTimersByTimeAsync(600)
      expect(reload).not.toHaveBeenCalled()
      wrapper.unmount()
      expect(mocks.wsUnsub).toHaveBeenCalled()
    })

    it('кнопка «Обновить» не шлёт запрос, пока идёт загрузка', () => {
      const { reload, isLoading, api } = mountWs()
      isLoading.value = true
      api().refresh()
      expect(reload).not.toHaveBeenCalled()
      isLoading.value = false
      api().refresh()
      expect(reload).toHaveBeenCalledTimes(1)
    })
  })
})
