// Правка и удаление комментариев, права в меню: править — только свой,
// удалять — свой или любой под своим постом (модерация автора), блокировать,
// донатить и жаловаться — только на чужой; неподтверждённые и отклонённые
// сетью — без действий. Удаление оптимистичное с откатом при ошибке, правка
// уходит commentEdit с исходным msg (картинки не теряются).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { GetComment } from '@/types/rpc-responses/get-comments'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  haptic: vi.fn(),
  sendComment: vi.fn(),
  deleteComment: vi.fn(),
  comments: {
    deletedCommentIds: {} as Record<string, boolean>,
    editedMessages: {} as Record<string, string>,
    markDeleted: vi.fn(),
    unmarkDeleted: vi.fn(),
    rememberTxForComment: vi.fn(),
    setEditedMessage: vi.fn(),
  },
  relations: {
    blocked: new Set<string>(),
    pending: new Set<string>(),
    isBlocked: (a: string) => mocks.relations.blocked.has(a),
    isPending: (a: string) => mocks.relations.pending.has(a),
    block: vi.fn(),
    unblock: vi.fn(),
  },
}))
vi.mock('ant-design-vue', () => ({ Modal: { confirm: mocks.confirm } }))
vi.mock('@/components/icons', () => ({ ExclamationCircleOutlined: {} }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { error: mocks.toastError, success: mocks.toastSuccess },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key, tn: (key: string) => key }))
vi.mock('@/helpers/common/haptics', () => ({ haptic: mocks.haptic }))
vi.mock('@/stores', () => ({
  useCommentsStore: () => mocks.comments,
  useUserRelationsStore: () => mocks.relations,
}))
vi.mock('../comment-sender', () => ({ sendComment: mocks.sendComment }))
vi.mock('../comment-deleter', () => ({ deleteComment: mocks.deleteComment }))

import { COMMENT_MAX_LENGTH } from '../consts'
import { useCommentEditDelete } from './use-comment-edit-delete'

const ME = 'PMe'
const AUTHOR = 'PAuthor'
const OTHER = 'POther'

function comment(overrides: Partial<GetComment> = {}): GetComment {
  return {
    id: 'c1',
    postid: 'post1',
    address: ME,
    parentid: '',
    answerid: '',
    msg: JSON.stringify({ message: 'Привет', url: '', images: ['https://img/1.jpg'], info: '' }),
    ...overrides,
  } as GetComment
}

function setup(opts: { me?: string; postAuthor?: string; list?: GetComment[] } = {}) {
  return useCommentEditDelete({
    postId: ref('post1'),
    currentUserAddress: ref(opts.me ?? ME),
    postAuthorAddress: ref(opts.postAuthor ?? AUTHOR),
    allComments: ref(opts.list ?? [comment()]),
    repliesByParentId: ref({ c1: [comment({ id: 'r1', parentid: 'c1', address: OTHER })] }),
  })
}

/** Жмёт «ОК» в последнем окне подтверждения. */
async function confirmLast() {
  const options = mocks.confirm.mock.lastCall![0] as { onOk: () => unknown }
  await options.onOk()
}

describe('useCommentEditDelete', () => {
  beforeEach(() => {
    for (const fn of [
      mocks.confirm,
      mocks.toastError,
      mocks.toastSuccess,
      mocks.haptic,
      mocks.comments.markDeleted,
      mocks.comments.unmarkDeleted,
      mocks.comments.rememberTxForComment,
      mocks.comments.setEditedMessage,
      mocks.relations.block,
      mocks.relations.unblock,
    ])
      fn.mockReset()
    mocks.comments.deletedCommentIds = {}
    mocks.comments.editedMessages = {}
    mocks.relations.blocked.clear()
    mocks.relations.pending.clear()
    mocks.sendComment.mockReset().mockResolvedValue('tx-edit')
    mocks.deleteComment.mockReset().mockResolvedValue('tx-del')
  })

  describe('права', () => {
    it('свой комментарий: править и удалять можно, блокировать, донатить и жаловаться — нет', () => {
      const c = setup()
      const own = comment()
      expect(c.canEditComment(own)).toBe(true)
      expect(c.canDeleteComment(own)).toBe(true)
      expect(c.canBlockUser(own)).toBe(false)
      expect(c.canDonateComment(own)).toBe(false)
      expect(c.canReportComment(own)).toBe(false)
      expect(c.canShowMenu(own)).toBe(true)
    })

    it('чужой под чужим постом: не править и не удалять, но блок, донат и жалоба', () => {
      const c = setup()
      const foreign = comment({ address: OTHER })
      expect(c.canEditComment(foreign)).toBe(false)
      expect(c.canDeleteComment(foreign)).toBe(false)
      expect(c.canBlockUser(foreign)).toBe(true)
      expect(c.canDonateComment(foreign)).toBe(true)
      expect(c.canReportComment(foreign)).toBe(true)
    })

    it('автор поста удаляет чужие комментарии под ним, но не правит их', () => {
      const c = setup({ me: AUTHOR })
      const foreign = comment({ address: OTHER })
      expect(c.canDeleteComment(foreign)).toBe(true)
      expect(c.canEditComment(foreign)).toBe(false)
    })

    it('гость не может ничего, кроме «поделиться»', () => {
      const c = setup({ me: '' })
      const foreign = comment({ address: OTHER })
      expect(c.canEditComment(foreign)).toBe(false)
      expect(c.canDeleteComment(foreign)).toBe(false)
      expect(c.canBlockUser(foreign)).toBe(false)
      expect(c.canDonateComment(foreign)).toBe(false)
      expect(c.canShareComment(foreign)).toBe(true)
    })

    it('неподтверждённый и отклонённый сетью — без действий', () => {
      const c = setup()
      for (const state of [{ temp: true }, { relay: true }, { rejected: true }]) {
        const own = comment(state as Partial<GetComment>)
        expect(c.canEditComment(own)).toBe(false)
        expect(c.canDeleteComment(own)).toBe(false)
        expect(c.canShareComment(own)).toBe(false)
        expect(c.canInteractWithComment(own)).toBe(false)
      }
      expect(c.isCommentPending(comment({ temp: true } as Partial<GetComment>))).toBe(true)
      expect(c.isCommentRejected(comment({ rejected: true } as Partial<GetComment>))).toBe(true)
    })

    it('удалённый (с ноды или только что у себя) — без меню', () => {
      const c = setup()
      expect(c.canShowMenu(comment({ deleted: true } as Partial<GetComment>))).toBe(false)
      mocks.comments.deletedCommentIds = { c1: true }
      expect(c.isCommentDeleted(comment())).toBe(true)
      expect(c.canShowMenu(comment())).toBe(false)
    })
  })

  describe('удаление', () => {
    it('сначала спрашивает; после «ОК» прячет сразу и отправляет commentDelete', async () => {
      const c = setup()
      const reply = comment({ id: 'r1', parentid: 'c1', answerid: 'c1' })
      c.confirmDeleteComment(reply)
      expect(mocks.deleteComment).not.toHaveBeenCalled()

      await confirmLast()
      expect(mocks.comments.markDeleted).toHaveBeenCalledWith('r1')
      expect(mocks.deleteComment).toHaveBeenCalledWith({
        postId: 'post1',
        commentId: 'r1',
        parentId: 'c1',
        answerId: 'c1',
      })
      expect(mocks.comments.rememberTxForComment).toHaveBeenCalledWith('tx-del', 'r1')
      expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'commentsMsg.deleteSuccess' })
      expect(c.commentDeleteSubmitting.value).toBeNull()
    })

    it('отказ сети возвращает комментарий на место', async () => {
      mocks.deleteComment.mockRejectedValue(new Error('Лимит исчерпан'))
      const c = setup()
      c.confirmDeleteComment(comment())
      await confirmLast()
      expect(mocks.comments.unmarkDeleted).toHaveBeenCalledWith('c1')
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'Лимит исчерпан' })
    })

    it('повторное «ОК», пока удаление идёт, второй транзакции не шлёт', async () => {
      let finish!: (txid: string) => void
      mocks.deleteComment.mockReturnValue(new Promise((resolve) => (finish = resolve)))
      const c = setup()
      c.confirmDeleteComment(comment())
      const first = confirmLast()
      await confirmLast()
      expect(mocks.deleteComment).toHaveBeenCalledTimes(1)
      finish('tx-del')
      await first
    })
  })

  describe('правка', () => {
    it('форма заполняется текстом комментария, после своей правки — новым текстом', () => {
      const c = setup()
      c.openEditComment(comment())
      expect(c.editingCommentId.value).toBe('c1')
      expect(c.editDraft.value).toBe('Привет')
      expect(c.isEditingComment(comment())).toBe(true)

      mocks.comments.editedMessages = { c1: 'Привет всем' }
      c.openEditComment(comment())
      expect(c.editDraft.value).toBe('Привет всем')

      expect(c.getCommentMessagePlain(comment({ id: 'x', msg: 'старый формат' }))).toBe(
        'старый формат'
      )
    })

    it('закрытие без изменений — сразу, с изменениями — после подтверждения', async () => {
      const c = setup()
      c.openEditComment(comment())
      c.requestCloseEdit()
      expect(c.editingCommentId.value).toBeNull()
      expect(mocks.confirm).not.toHaveBeenCalled()

      c.openEditComment(comment())
      c.editDraft.value = 'Привет!'
      c.requestCloseEdit()
      expect(c.editingCommentId.value).toBe('c1')
      await confirmLast()
      expect(c.editingCommentId.value).toBeNull()
    })

    it('сохранение: commentEdit с исходным msg, текст подменяется сразу', async () => {
      const own = comment()
      const c = setup({ list: [own] })
      c.openEditComment(own)
      c.editDraft.value = '  Привет, мир  '
      await c.submitEdit()

      expect(mocks.sendComment).toHaveBeenCalledWith('post1', '', '', 'Привет, мир', 'c1', own.msg)
      expect(mocks.comments.setEditedMessage).toHaveBeenCalledWith('c1', 'Привет, мир')
      expect(mocks.comments.rememberTxForComment).toHaveBeenCalledWith('tx-edit', 'c1')
      expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'commentsMsg.editSuccess' })
      expect(c.editingCommentId.value).toBeNull()
    })

    it('ответ в ветке находится среди ответов и уходит со своими parentid/answerid', async () => {
      const c = setup()
      const reply = comment({ id: 'r1', parentid: 'c1', address: ME })
      c.openEditComment(reply)
      c.editDraft.value = 'другой ответ'
      await c.submitEdit()
      expect(mocks.sendComment.mock.lastCall!.slice(0, 5)).toEqual([
        'post1',
        'c1',
        '',
        'другой ответ',
        'r1',
      ])
    })

    it('пустой текст, тот же текст, слишком длинный или пропавший комментарий — не отправляется', async () => {
      const c = setup()
      c.openEditComment(comment())
      c.editDraft.value = '   '
      await c.submitEdit()

      c.editDraft.value = ' Привет '
      await c.submitEdit()
      expect(c.editingCommentId.value).toBeNull()

      c.openEditComment(comment())
      c.editDraft.value = 'я'.repeat(COMMENT_MAX_LENGTH + 1)
      await c.submitEdit()
      expect(mocks.toastError).toHaveBeenLastCalledWith({ message: 'commentsMsg.tooLong' })

      c.openEditComment(comment({ id: 'gone' }))
      c.editDraft.value = 'новый текст'
      await c.submitEdit()
      expect(mocks.toastError).toHaveBeenLastCalledWith({ message: 'commentsMsg.notFound' })

      expect(mocks.sendComment).not.toHaveBeenCalled()
    })

    it('отказ сети: тост, форма остаётся открытой с текстом', async () => {
      mocks.sendComment.mockRejectedValue(new Error('нет связи'))
      const c = setup()
      c.openEditComment(comment())
      c.editDraft.value = 'новый текст'
      await c.submitEdit()
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'нет связи' })
      expect(c.editingCommentId.value).toBe('c1')
      expect(c.editDraft.value).toBe('новый текст')
      expect(c.editSubmitting.value).toBe(false)
    })
  })

  describe('блокировка автора', () => {
    it('после подтверждения блокирует; пока запрос идёт — повторно нельзя', async () => {
      const c = setup()
      const foreign = comment({ address: OTHER })
      c.confirmBlockUser(foreign)
      await confirmLast()
      expect(mocks.relations.block).toHaveBeenCalledWith(OTHER)
      expect(mocks.toastSuccess).toHaveBeenCalledWith({ message: 'commentsMsg.blockSuccess' })

      mocks.relations.pending.add(OTHER)
      expect(c.isBlockPending(foreign)).toBe(true)
      await c.unblockUser(foreign)
      expect(mocks.relations.unblock).not.toHaveBeenCalled()
    })

    it('ошибка разблокировки — тост с причиной', async () => {
      mocks.relations.unblock.mockRejectedValue(new Error('offline'))
      mocks.relations.blocked.add(OTHER)
      const c = setup()
      const foreign = comment({ address: OTHER })
      expect(c.isUserBlocked(foreign)).toBe(true)
      await c.unblockUser(foreign)
      expect(mocks.toastError).toHaveBeenCalledWith({ message: 'offline' })
    })
  })
})
