/**
 * Inline-редактирование и удаление комментариев.
 *
 * Edit: открытие/закрытие inline-формы, submit через sendComment(editId).
 * Delete: confirm modal + optimistic markDeleted с откатом при ошибке.
 *
 * Также включает can* проверки (canEditComment / canDeleteComment / canShowMenu /
 * isCommentDeleted / canInteractWithComment).
 */

import { ref, h, type Ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { haptic } from '@/helpers/common/haptics'
import { useCommentsStore, useUserRelationsStore } from '@/stores'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { sendComment } from '../comment-sender'
import { deleteComment } from '../comment-deleter'
import { isCommentLengthValid, getCommentTxState } from '../helpers'

export interface UseCommentEditDeleteOptions {
  postId: Ref<string>
  currentUserAddress: Ref<string>
  postAuthorAddress: Ref<string>
  /** Доступ к загруженным веткам/комментам — нужен для findCommentById. */
  allComments: Ref<GetComment[] | null>
  repliesByParentId: Ref<Record<string, GetComment[]>>
}

export function useCommentEditDelete(opts: UseCommentEditDeleteOptions) {
  const commentDeleteSubmitting = ref<string | null>(null)
  const editingCommentId = ref<string | null>(null)
  const editDraft = ref('')
  const editInitialDraft = ref('')
  const editSubmitting = ref(false)

  // --- Состояние ---
  const isCommentDeleted = (comment: GetComment): boolean => {
    return !!comment.deleted || useCommentsStore().deletedCommentIds[comment.id] === true
  }
  const canEditComment = (comment: GetComment): boolean => {
    // Только свой, не удалённый, не в pending/rejected (legacy: metmenu.html:51-62)
    const me = opts.currentUserAddress.value
    if (!me || comment.address !== me) return false
    if (isCommentDeleted(comment)) return false
    if (getCommentTxState(comment) !== 'normal') return false
    return true
  }
  const canDeleteComment = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value
    if (!me || isCommentDeleted(comment)) return false
    if (getCommentTxState(comment) !== 'normal') return false
    // Свой комментарий — можно. Автор поста может удалять чужие (модерация).
    if (comment.address === me) return true
    if (opts.postAuthorAddress.value && opts.postAuthorAddress.value === me) return true
    return false
  }
  // --- Block / Unblock автора (user-relations) ---
  /** Можно ли (раз)блокировать автора: чужой коммент, авторизован, не temp/rejected. */
  const canBlockUser = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value
    if (!me) return false
    if (!comment.address || comment.address === me) return false
    if (getCommentTxState(comment) !== 'normal') return false
    return true
  }
  /** Можно ли донатить автору коммента: чужой реальный коммент, авторизован. */
  const canDonateComment = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value
    if (!me) return false
    if (!comment.address || comment.address === me) return false
    return getCommentTxState(comment) === 'normal'
  }
  /** Можно ли пожаловаться на коммент: чужой реальный коммент, авторизован. */
  const canReportComment = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value
    if (!me) return false
    if (!comment.address || comment.address === me) return false
    return getCommentTxState(comment) === 'normal'
  }

  const isUserBlocked = (comment: GetComment): boolean =>
    useUserRelationsStore().isBlocked(comment.address)
  const isBlockPending = (comment: GetComment): boolean =>
    useUserRelationsStore().isPending(comment.address)

  const blockUserFromComment = async (comment: GetComment): Promise<void> => {
    const store = useUserRelationsStore()
    if (store.isPending(comment.address)) return
    try {
      await store.block(comment.address)
      haptic('medium')
      appToast.success({ message: t('commentsMsg.blockSuccess') })
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('commentsMsg.blockError') })
    }
  }

  const confirmBlockUser = (comment: GetComment): void => {
    Modal.confirm({
      title: t('commentsMsg.blockConfirmTitle'),
      icon: h(ExclamationCircleOutlined),
      content: t('commentsMsg.blockConfirmContent'),
      okText: t('commentsMsg.blockConfirmOk'),
      okType: 'danger',
      cancelText: t('commentsMsg.cancel'),
      centered: true,
      onOk: () => blockUserFromComment(comment),
    })
  }

  const unblockUser = async (comment: GetComment): Promise<void> => {
    const store = useUserRelationsStore()
    if (store.isPending(comment.address)) return
    try {
      await store.unblock(comment.address)
      haptic('medium')
      appToast.success({ message: t('commentsMsg.unblockSuccess') })
    } catch (e) {
      appToast.error({ message: e instanceof Error ? e.message : t('commentsMsg.unblockError') })
    }
  }

  /** Можно ли поделиться ссылкой на коммент: реальный txid (не pending/rejected), не удалён. */
  const canShareComment = (comment: GetComment): boolean => {
    if (isCommentDeleted(comment)) return false
    return getCommentTxState(comment) === 'normal'
  }

  const canShowMenu = (comment: GetComment): boolean => {
    if (isCommentDeleted(comment)) return false
    return (
      canEditComment(comment) ||
      canDeleteComment(comment) ||
      canBlockUser(comment) ||
      canDonateComment(comment) ||
      canReportComment(comment) ||
      canShareComment(comment)
    )
  }
  const isCommentPending = (comment: GetComment): boolean =>
    getCommentTxState(comment) === 'pending'
  const isCommentRejected = (comment: GetComment): boolean =>
    getCommentTxState(comment) === 'rejected'
  const canInteractWithComment = (comment: GetComment): boolean => {
    if (isCommentDeleted(comment)) return false
    if (getCommentTxState(comment) !== 'normal') return false
    return true
  }
  const isEditingComment = (comment: GetComment): boolean => editingCommentId.value === comment.id

  // --- Delete ---
  const confirmDeleteComment = (comment: GetComment): void => {
    Modal.confirm({
      title: t('commentsMsg.deleteConfirmTitle'),
      icon: h(ExclamationCircleOutlined),
      content: t('commentsMsg.deleteConfirmContent'),
      okText: t('commentsMsg.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('commentsMsg.cancel'),
      centered: true,
      onOk: () => deleteCommentInternal(comment),
    })
  }

  const deleteCommentInternal = async (comment: GetComment): Promise<void> => {
    if (commentDeleteSubmitting.value === comment.id) return
    commentDeleteSubmitting.value = comment.id
    const commentsStore = useCommentsStore()
    // Optimistic: сразу прячем меню/контент через флаг в общем сторе;
    // при ошибке откатываем — иначе оверрайд снимется при reconcile с RPC / при WS подтверждении.
    commentsStore.markDeleted(comment.id)
    try {
      await deleteComment({
        postId: opts.postId.value,
        commentId: comment.id,
        parentId: comment.parentid || '',
        answerId: comment.answerid || '',
      })
      haptic('medium')
      appToast.success({ message: t('commentsMsg.deleteSuccess') })
    } catch (e) {
      commentsStore.unmarkDeleted(comment.id)
      appToast.error({
        message: e instanceof Error ? e.message : t('commentsMsg.deleteError'),
      })
    } finally {
      commentDeleteSubmitting.value = null
    }
  }

  // --- Edit ---
  /** Текущий текст сообщения как plain (для предзаполнения формы редактирования) */
  const getCommentMessagePlain = (comment: GetComment): string => {
    const overridden = useCommentsStore().editedMessages[comment.id]
    if (typeof overridden === 'string') return overridden
    try {
      const parsed = JSON.parse(comment.msg) as { message?: string }
      return parsed?.message ?? comment.msg
    } catch {
      return comment.msg
    }
  }

  const openEditComment = (comment: GetComment): void => {
    const initial = getCommentMessagePlain(comment)
    editingCommentId.value = comment.id
    editDraft.value = initial
    editInitialDraft.value = initial
    editSubmitting.value = false
  }

  const closeEdit = (): void => {
    editingCommentId.value = null
    editDraft.value = ''
    editInitialDraft.value = ''
    editSubmitting.value = false
  }

  const requestCloseEdit = (): void => {
    // Если изменений нет — закрываем без подтверждения, иначе — confirm-modal
    if ((editDraft.value || '') === (editInitialDraft.value || '')) {
      closeEdit()
      return
    }
    Modal.confirm({
      title: t('commentsMsg.discardEditTitle'),
      icon: h(ExclamationCircleOutlined),
      content: t('commentsMsg.discardEditContent'),
      okText: t('commentsMsg.discardEditOk'),
      cancelText: t('commentsMsg.no'),
      centered: true,
      onOk: () => closeEdit(),
    })
  }

  /** Находит комментарий по id среди корневых и ответов */
  const findCommentById = (id: string): GetComment | null => {
    if (opts.allComments.value) {
      const found = opts.allComments.value.find((c) => c.id === id)
      if (found) return found
    }
    for (const list of Object.values(opts.repliesByParentId.value)) {
      if (Array.isArray(list)) {
        const found = (list as GetComment[]).find((c) => c.id === id)
        if (found) return found
      }
    }
    return null
  }

  const submitEdit = async (): Promise<void> => {
    const id = editingCommentId.value
    if (!id || editSubmitting.value) return
    const text = (editDraft.value || '').trim()
    if (!text) return
    if (!isCommentLengthValid(text)) {
      appToast.error({ message: t('commentsMsg.tooLong') })
      return
    }
    if (text === (editInitialDraft.value || '').trim()) {
      closeEdit()
      return
    }
    const comment = findCommentById(id)
    if (!comment) {
      appToast.error({ message: t('commentsMsg.notFound') })
      return
    }
    editSubmitting.value = true
    try {
      await sendComment(
        opts.postId.value,
        comment.parentid || '',
        comment.answerid || '',
        text,
        id // editId — переключает sendComment в режим commentEdit
      )
      haptic('small')
      // Optimistic: подменяем текст до прихода обновлённой версии (через стор)
      useCommentsStore().setEditedMessage(id, text)
      appToast.success({ message: t('commentsMsg.editSuccess') })
      closeEdit()
    } catch (e) {
      appToast.error({
        message: e instanceof Error ? e.message : t('commentsMsg.editError'),
      })
    } finally {
      editSubmitting.value = false
    }
  }

  return {
    commentDeleteSubmitting,
    editingCommentId,
    editDraft,
    editInitialDraft,
    editSubmitting,
    isCommentDeleted,
    canEditComment,
    canDeleteComment,
    canBlockUser,
    canDonateComment,
    canReportComment,
    isUserBlocked,
    isBlockPending,
    confirmBlockUser,
    unblockUser,
    canShareComment,
    canShowMenu,
    isCommentPending,
    isCommentRejected,
    canInteractWithComment,
    isEditingComment,
    confirmDeleteComment,
    openEditComment,
    closeEdit,
    requestCloseEdit,
    submitEdit,
    findCommentById,
    getCommentMessagePlain,
  }
}
