import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'

const { sendComment, commentsStore, toast } = vi.hoisted(() => ({
  sendComment: vi.fn(async () => 'TXID'),
  commentsStore: { addPending: vi.fn(), replacePendingId: vi.fn(), removePending: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/helpers/common/haptics', () => ({ haptic: vi.fn() }))
vi.mock('@/helpers/common/post-title-resolver', () => ({
  resolvePostTitleFromPost: () => ({ title: 'T' }),
}))
vi.mock('@/stores', () => ({
  useCommentsStore: () => commentsStore,
  usePostsStore: () => ({ getPostByShareId: () => undefined }),
}))
vi.mock('../comment-sender', () => ({ sendComment }))
vi.mock('./comment-draft-storage', () => ({
  readCommentDraft: () => '',
  writeCommentDraft: vi.fn(),
  clearCommentDraft: vi.fn(),
}))

import { useCommentForm } from './use-comment-form'

function form() {
  const repliesExpanded = ref<Record<string, boolean>>({})
  const api = useCommentForm({
    postId: ref('POST'),
    currentUserAddress: ref('ME'),
    composerDisableReason: computed(() => null),
    allComments: ref([]),
    visibleCommentsCount: ref(0),
    commentsCollapsed: ref(false),
    repliesExpanded,
    refreshAllComments: vi.fn(async () => {}),
    emitComment: vi.fn(),
    rootMentionListRef: ref(null),
    mentionListRef: ref(null),
    rootReplyTextareaRef: ref(null),
    replyTextareaRef: ref(null),
    filteredMentionUsers: computed(() => []),
  })
  return { api, repliesExpanded }
}

const root = { id: 'c1', parentid: '', address: 'A', userprofile: { name: 'alice' } } as never
const reply = { id: 'r1', parentid: 'c1', address: 'B', userprofile: { name: 'bob' } } as never

beforeEach(() => vi.clearAllMocks())

describe('sendReply — parentid/answerid как в legacy (K4)', () => {
  it('ответ на ответ уходит с parentid = корень ветки, answerid = сам ответ', async () => {
    const { api, repliesExpanded } = form()
    api.onReplyToSecondLevel(reply)
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'r1', 'hi')
    expect(commentsStore.addPending).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'c1', answerId: 'r1', postId: 'POST' })
    )
    expect(repliesExpanded.value['c1']).toBe(true)
    expect(commentsStore.replacePendingId).toHaveBeenCalledWith(
      'POST',
      expect.stringMatching(/^local-/),
      'TXID'
    )
  })

  it('«ответить автору» на ответ: префикс @ник, parentid = корень', async () => {
    const { api } = form()
    api.onReplyToComment(reply)
    expect(api.replyDraft.value).toBe('@bob, ')
    api.replyDraft.value = '@bob, ok'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'r1', '@bob, ok')
  })

  it('ответ на корневой комментарий: parentid = answerid = его id', async () => {
    const { api } = form()
    api.onReplyToFirstLevel(root)
    api.replyDraft.value = 'yo'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', 'c1', 'c1', 'yo')
  })

  it('корневой комментарий к посту: parentid и answerid пустые', async () => {
    const { api } = form()
    api.openReplyToPost()
    api.replyDraft.value = 'root'
    await api.sendReply()
    expect(sendComment).toHaveBeenCalledWith('POST', '', '', 'root')
  })

  it('ошибка отправки: pending снимается, черновик и цель возвращаются', async () => {
    sendComment.mockRejectedValueOnce(new Error('node'))
    const { api } = form()
    api.onReplyToSecondLevel(reply)
    api.replyDraft.value = 'hi'
    await api.sendReply()
    expect(commentsStore.removePending).toHaveBeenCalled()
    expect(api.replyDraft.value).toBe('hi')
    expect(api.replyTarget.value).toEqual({ commentId: 'r1', parentId: 'c1', prefix: '' })
    expect(toast.error).toHaveBeenCalledWith({ message: 'node' })
  })
})
