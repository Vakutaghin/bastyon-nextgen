/**
 * Видимость комментариев: скрытие по репутации автора / blocked account.
 * Учитывает локальный override через commentsStore.isRevealed (пользователь
 * нажал «Показать всё равно»).
 */

import type { Ref } from 'vue'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import { useCommentsStore, useUserRelationsStore } from '@/stores'
import {
  isHiddenByReputation as visIsHiddenByReputation,
  isAuthorAccountLocked as visIsAuthorAccountLocked,
  isBlockedByMe as visIsBlockedByMe,
} from '../visibility'

/** Причина скрытия комментария (для выбора текста баннера). */
export type HiddenReason = 'blocked' | 'reputation' | null

export interface UseCommentVisibilityOptions {
  currentUserAddress: Ref<string>
  isDeleted: (comment: GetComment) => boolean
}

export function useCommentVisibility(opts: UseCommentVisibilityOptions) {
  /** Заблокирован ли автор комментария текущим пользователем. */
  const isBlockedAuthor = (comment: GetComment): boolean =>
    visIsBlockedByMe(comment, useUserRelationsStore().blockedSet)

  /** Скрыт ли коммент по правилам видимости (блок-лист, репутация автора и т.п.) */
  const isCommentHiddenByVisibility = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value || undefined
    if (isBlockedAuthor(comment)) return true
    if (visIsHiddenByReputation(comment, me)) return true
    if (visIsAuthorAccountLocked(comment)) return true
    return false
  }

  /** Причина скрытия (для текста баннера). Приоритет у блокировки. */
  const hiddenReason = (comment: GetComment): HiddenReason => {
    const me = opts.currentUserAddress.value || undefined
    if (isBlockedAuthor(comment)) return 'blocked'
    if (visIsHiddenByReputation(comment, me) || visIsAuthorAccountLocked(comment))
      return 'reputation'
    return null
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

  /** Принадлежит ли коммент текущему пользователю (для подсветки `.is-mine`). */
  const isMyComment = (comment: GetComment): boolean => {
    const me = opts.currentUserAddress.value
    return !!me && comment.address === me
  }

  return {
    isCommentHiddenByVisibility,
    hiddenReason,
    isHiddenRevealed,
    shouldHideContent,
    revealHiddenComment,
    isMyComment,
  }
}
