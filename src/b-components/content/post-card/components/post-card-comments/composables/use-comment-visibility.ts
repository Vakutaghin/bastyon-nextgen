/**
 * Видимость комментариев: скрытие по репутации автора / blocked account.
 * Учитывает локальный override через commentsStore.isRevealed (пользователь
 * нажал «Показать всё равно»).
 */

import type { Ref } from 'vue'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { useCommentsStore } from '@/stores'
import {
  isHiddenByReputation as visIsHiddenByReputation,
  isAuthorAccountLocked as visIsAuthorAccountLocked,
} from '../visibility'

export interface UseCommentVisibilityOptions {
  currentUserAddress: Ref<string>
  isDeleted: (comment: GetComment) => boolean
}

export function useCommentVisibility(opts: UseCommentVisibilityOptions) {
  /** Скрыт ли коммент по правилам видимости (репутация автора и т.п.) */
  const isCommentHiddenByVisibility = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value || undefined
    if (visIsHiddenByReputation(comment, me)) return true
    if (visIsAuthorAccountLocked(comment)) return true
    return false
  }

  /** Раскрыл ли пользователь скрытый коммент через «Показать всё равно» */
  const isHiddenRevealed = (comment: GetComment): boolean => {
    return useCommentsStore().isRevealed(comment.id)
  }

  /** Должен ли быть скрыт контент (с учётом revealed-флага) */
  const shouldHideContent = (comment: GetComment): boolean => {
    if (opts.isDeleted(comment)) return false
    if (!isCommentHiddenByVisibility(comment)) return false
    return !isHiddenRevealed(comment)
  }

  const revealHiddenComment = (comment: GetComment): void => {
    useCommentsStore().revealHidden(comment.id)
  }

  return {
    isCommentHiddenByVisibility,
    isHiddenRevealed,
    shouldHideContent,
    revealHiddenComment,
  }
}
