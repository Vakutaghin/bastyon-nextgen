import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { toast, donate, report } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  donate: { open: vi.fn() },
  report: { open: vi.fn() },
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/b-components/app-toast', () => ({ appToast: toast }))
vi.mock('@/stores', () => ({ useDonateStore: () => donate, useReportStore: () => report }))

import { buildCommentPermalink, useCommentMenuActions } from './use-comment-menu-actions'

const comment = {
  id: 'c2',
  parentid: 'c1',
  address: 'PADDR',
  userprofile: { name: 'bob' },
} as never

function setup() {
  const editDelete = {
    confirmDeleteComment: vi.fn(),
    openEditComment: vi.fn(),
    confirmBlockUser: vi.fn(),
    unblockUser: vi.fn(async () => {}),
  }
  const api = useCommentMenuActions({ postId: ref('POST'), editDelete: editDelete as never })
  return { api, editDelete }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    location: { origin: 'https://app.test' },
    navigator: { clipboard: { writeText: vi.fn(async () => {}) } },
  })
})

describe('buildCommentPermalink', () => {
  it('ответ → commentid + parentid; корневой комментарий → только commentid', () => {
    expect(buildCommentPermalink('https://o', 'P', { id: 'c2', parentid: 'c1' })).toBe(
      'https://o/post/P?commentid=c2&parentid=c1'
    )
    expect(buildCommentPermalink('https://o', 'P', { id: 'c1', parentid: 'c1' })).toBe(
      'https://o/post/P?commentid=c1'
    )
    expect(buildCommentPermalink('', 'P', { id: 'c1', parentid: '' })).toBe('/post/P?commentid=c1')
  })
})

describe('useCommentMenuActions', () => {
  it('диспетчер меню зовёт нужный обработчик', () => {
    const { api, editDelete } = setup()
    api.onCommentMenuAction(comment, 'delete')
    api.onCommentMenuAction(comment, 'edit')
    api.onCommentMenuAction(comment, 'block')
    api.onCommentMenuAction(comment, 'unblock')
    api.onCommentMenuAction(comment, 'donate')
    api.onCommentMenuAction(comment, 'report')
    expect(editDelete.confirmDeleteComment).toHaveBeenCalledWith(comment)
    expect(editDelete.openEditComment).toHaveBeenCalledWith(comment)
    expect(editDelete.confirmBlockUser).toHaveBeenCalledWith(comment)
    expect(editDelete.unblockUser).toHaveBeenCalledWith(comment)
    expect(donate.open).toHaveBeenCalledWith({ address: 'PADDR', name: 'bob' })
    expect(report.open).toHaveBeenCalledWith({
      contentHash: 'c2',
      authorAddress: 'PADDR',
      type: 'comment',
    })
  })

  it('share без Web Share API → буфер обмена + тост со ссылкой', async () => {
    const { api } = setup()
    await api.shareComment(comment)
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://app.test/post/POST?commentid=c2&parentid=c1'
    )
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'https://app.test/post/POST?commentid=c2&parentid=c1',
      })
    )
  })

  it('share через navigator.share; AbortError — молча, другая ошибка → fallback в буфер', async () => {
    const { api } = setup()
    const share = vi.fn(async () => {})
    ;(window.navigator as { share?: unknown }).share = share
    await api.shareComment(comment)
    expect(share).toHaveBeenCalledWith({
      url: 'https://app.test/post/POST?commentid=c2&parentid=c1',
    })
    expect(window.navigator.clipboard.writeText).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }))
    await api.shareComment(comment)
    expect(window.navigator.clipboard.writeText).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(new Error('unsupported'))
    await api.shareComment(comment)
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('буфер недоступен → тост об ошибке', async () => {
    const { api } = setup()
    ;(window.navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('denied')
    )
    await api.shareComment(comment)
    expect(toast.error).toHaveBeenCalledWith({ message: 'commentsMsg.shareFailed' })
  })
})
