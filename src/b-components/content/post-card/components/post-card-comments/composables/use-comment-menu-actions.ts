/**
 * Действия контекстного меню комментария (edit/delete/block/unblock/share/
 * donate/report) + permalink-шаринг (#16). Вынесено из post-card-comments.vue:
 * диспетчер зависит только от edit-delete composable и postId, а сборка
 * permalink — чистая функция, проверяемая без DOM.
 */

import type { Ref } from 'vue'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import { publicShareOrigin } from '@/helpers/common/share-origin'
import { useDonateStore, useReportStore } from '@/stores'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { CommentMenuAction } from '../types'
import type { useCommentEditDelete } from './use-comment-edit-delete'

export interface UseCommentMenuActionsOptions {
  postId: Ref<string>
  editDelete: ReturnType<typeof useCommentEditDelete>
}

/** Deep-link на /post/:txid?commentid=&parentid= (parentid — только для ответов). */
export function buildCommentPermalink(
  origin: string,
  postId: string,
  comment: Pick<GetComment, 'id' | 'parentid'>
): string {
  const params = new URLSearchParams({ commentid: comment.id })
  if (comment.parentid && comment.parentid !== comment.id) {
    params.set('parentid', comment.parentid)
  }
  return `${origin}/post/${postId}?${params.toString()}`
}

export function useCommentMenuActions(opts: UseCommentMenuActionsOptions) {
  const { editDelete } = opts

  // Web Share API на мобильных, иначе — копирование в буфер.
  async function shareComment(comment: GetComment): Promise<void> {
    // Публичный origin: ссылкой делятся, а `tauri://localhost` получатель не
    // откроет (S20).
    const url = buildCommentPermalink(publicShareOrigin(), opts.postId.value, comment)
    const nav = window.navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ url })
        return
      } catch (e) {
        // AbortError — пользователь закрыл диалог, не ошибка; иначе падаем в clipboard.
        if ((e instanceof Error ? e.name : '') === 'AbortError') return
      }
    }
    try {
      await window.navigator.clipboard.writeText(url)
      appToast.success({ message: t('commentsMsg.linkCopied'), description: url })
    } catch {
      appToast.error({ message: t('commentsMsg.shareFailed') })
    }
  }

  function onCommentMenuAction(comment: GetComment, action: CommentMenuAction): void {
    if (action === 'delete') {
      editDelete.confirmDeleteComment(comment)
      return
    }
    if (action === 'edit') {
      editDelete.openEditComment(comment)
      return
    }
    if (action === 'block') {
      editDelete.confirmBlockUser(comment)
      return
    }
    if (action === 'unblock') {
      void editDelete.unblockUser(comment)
      return
    }
    if (action === 'share') {
      void shareComment(comment)
      return
    }
    if (action === 'donate') {
      useDonateStore().open({
        address: comment.address,
        name: (comment as GetComment & { userprofile?: { name?: string } }).userprofile?.name,
      })
      return
    }
    if (action === 'report') {
      useReportStore().open({
        contentHash: comment.id,
        authorAddress: comment.address,
        type: 'comment',
      })
      return
    }
  }

  return { onCommentMenuAction, shareComment }
}
