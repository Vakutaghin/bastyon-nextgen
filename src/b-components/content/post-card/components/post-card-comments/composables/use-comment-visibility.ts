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
  isHiddenByPostAuthor as visIsHiddenByPostAuthor,
  isHiddenForExternalLink as visIsHiddenForExternalLink,
  isAuthorAccountLocked as visIsAuthorAccountLocked,
  isBlockedByMe as visIsBlockedByMe,
} from '../visibility'

/** Причина скрытия комментария (для выбора текста баннера). */
export type HiddenReason = 'blocked' | 'postAuthor' | 'reputation' | 'link' | null

/** Текст баннера скрытого комментария по причине. */
const HIDDEN_LABEL_KEYS: Record<Exclude<HiddenReason, null>, string> = {
  blocked: 'comments.hiddenBlocked',
  postAuthor: 'comments.hiddenByPostAuthor',
  reputation: 'comments.hiddenLowReputation',
  link: 'comments.hiddenExternalLink',
}

export interface UseCommentVisibilityOptions {
  currentUserAddress: Ref<string>
  isDeleted: (comment: GetComment) => boolean
}

export function useCommentVisibility(opts: UseCommentVisibilityOptions) {
  /** Заблокирован ли автор комментария текущим пользователем. */
  const isBlockedAuthor = (comment: GetComment): boolean =>
    visIsBlockedByMe(comment, useUserRelationsStore().blockedSet)

  /** Причина скрытия (для текста баннера). Приоритет у моей блокировки. */
  const hiddenReason = (comment: GetComment): HiddenReason => {
    const me = opts.currentUserAddress.value || undefined
    if (isBlockedAuthor(comment)) return 'blocked'
    if (visIsHiddenByPostAuthor(comment, me)) return 'postAuthor'
    if (visIsHiddenByReputation(comment, me) || visIsAuthorAccountLocked(comment))
      return 'reputation'
    if (visIsHiddenForExternalLink(comment, me)) return 'link'
    return null
  }

  /** Скрыт ли коммент по правилам видимости (блок-лист, репутация автора и т.п.) */
  const isCommentHiddenByVisibility = (comment: GetComment): boolean =>
    hiddenReason(comment) !== null

  /** Ключ текста баннера скрытого комментария. */
  const hiddenLabelKey = (comment: GetComment): string => {
    const reason = hiddenReason(comment)
    return reason ? HIDDEN_LABEL_KEYS[reason] : HIDDEN_LABEL_KEYS.reputation
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
    hiddenLabelKey,
    isHiddenRevealed,
    shouldHideContent,
    revealHiddenComment,
    isMyComment,
  }
}
