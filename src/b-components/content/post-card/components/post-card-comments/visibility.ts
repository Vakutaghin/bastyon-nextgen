/**
 * Helpers видимости комментариев и прав текущего пользователя.
 *
 * Аналог legacy:
 *   - components/comments/templates/list.html:5-15 (hiddenComment / lockedaccount / blockedbyme)
 *   - components/comments/index.js:702-708, 1327-1330 (reputationBlockedMe)
 *   - components/comments/index.js:227-231, 2361-2365 (myaccauntdeleted)
 *
 * Сейчас доступны только данные `comment.userprofile.reputation` и `userState.*_unspent`.
 * Полноценные блок-листы и признак удалённого аккаунта появятся вместе с user-relations
 * store в будущем — функции-заглушки оставлены расширяемыми через `BlockedAddrSet`.
 */

import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { UserState as UserStateData } from '@/types/rpc-responses/user-state'
import type { UserProfile } from '@/types/rpc-responses/user-get'

/**
 * Порог репутации, ниже которого комментарий считается скрытым по умолчанию.
 * В legacy psdk.user.hiddenComment имел сложный набор проверок; для nextgen
 * стартуем с простого порога — будем уточнять по мере появления данных.
 */
export const HIDE_BY_REPUTATION_THRESHOLD = -50

/** Порог репутации текущего пользователя ниже которого ему запрещено публиковать */
export const SELF_REP_BLOCK_THRESHOLD = -50

/**
 * Скрывать ли комментарий по репутации автора.
 * Возвращает true если репутация автора ниже порога и комментарий не свой/не админский.
 */
export function isHiddenByReputation(
  comment: GetComment,
  myAddress?: string,
  threshold = HIDE_BY_REPUTATION_THRESHOLD,
): boolean {
  if (myAddress && comment.address === myAddress) return false
  if (comment.deleted) return false
  const rep = comment.userprofile?.reputation
  if (typeof rep !== 'number') return false
  return rep < threshold
}

/**
 * Заблокирован ли автор комментария текущим пользователем.
 * `blockedSet` — список адресов из локального user-relations store; пустое
 * множество = блок-лист пока не загружен → не скрываем.
 */
export function isBlockedByMe(
  comment: GetComment,
  blockedSet?: ReadonlySet<string> | null,
): boolean {
  if (!blockedSet || blockedSet.size === 0) return false
  return blockedSet.has(comment.address)
}

/**
 * Закрыт ли аккаунт автора (legacy `reputationBlockedNotMe`).
 * Сейчас — заглушка: данные о блокировке аккаунта не приходят с getcomments.
 * Появится при подключении user-relations store.
 */
export function isAuthorAccountLocked(_comment: GetComment): boolean {
  return false
}

// --- Права текущего пользователя ---

export type DisableReason =
  | { kind: 'unauthenticated'; message: string }
  | { kind: 'limit-exhausted'; message: string }
  | { kind: 'reputation-blocked'; message: string }
  | { kind: 'account-deleted'; message: string }

/**
 * Может ли текущий пользователь публиковать комментарии. Возвращает причину запрета или null.
 */
export function getCommentPostingDisableReason(
  isAuthenticated: boolean,
  state: UserStateData | UserProfile | null,
): DisableReason | null {
  if (!isAuthenticated) {
    return { kind: 'unauthenticated', message: 'Войдите, чтобы оставить комментарий' }
  }
  if (!state) return null

  const stateData = state as UserStateData
  // Лимит на комментарии в текущем периоде
  if (typeof stateData.comment_unspent === 'number' && stateData.comment_unspent <= 0) {
    return {
      kind: 'limit-exhausted',
      message: 'Дневной лимит комментариев исчерпан. Попробуйте позже.',
    }
  }
  // Репутация ниже порога (упрощённый аналог reputationBlockedMe)
  const rep = (state as UserProfile).reputation
  if (typeof rep === 'number' && rep < SELF_REP_BLOCK_THRESHOLD) {
    return {
      kind: 'reputation-blocked',
      message: 'Ваша репутация слишком низка для публикации.',
    }
  }
  return null
}

/**
 * Может ли текущий пользователь голосовать за комментарии. Возвращает причину запрета или null.
 */
export function getCommentScoringDisableReason(
  isAuthenticated: boolean,
  state: UserStateData | UserProfile | null,
): DisableReason | null {
  if (!isAuthenticated) {
    return { kind: 'unauthenticated', message: 'Войдите, чтобы голосовать' }
  }
  if (!state) return null
  const stateData = state as UserStateData
  if (typeof stateData.comment_score_unspent === 'number' && stateData.comment_score_unspent <= 0) {
    return { kind: 'limit-exhausted', message: 'Дневной лимит оценок исчерпан' }
  }
  const rep = (state as UserProfile).reputation
  if (typeof rep === 'number' && rep < SELF_REP_BLOCK_THRESHOLD) {
    return { kind: 'reputation-blocked', message: 'Ваша репутация слишком низка для оценки' }
  }
  return null
}

/**
 * Условие срабатывания scam-предупреждения при дизлайке.
 *
 * В legacy `scamcriteria()` смотрел на ratio комментов/лайков пользователя за период.
 * Точные пороги не задокументированы; здесь используется упрощённое правило:
 *   - есть лимит комментариев И он использован более чем на 80% (много активности)
 *   - репутация низкая (склонность к злоупотреблению)
 *
 * Реальный alg будет уточнён по мере появления данных. Пока — простой эвристический сигнал.
 */
export function shouldShowScamWarningOnDislike(state: UserStateData | UserProfile | null): boolean {
  if (!state) return false
  const stateData = state as UserStateData
  const rep = (state as UserProfile).reputation
  const lowRep = typeof rep === 'number' && rep < 0
  let highActivity = false
  if (
    typeof stateData.comment_spent === 'number' &&
    typeof stateData.comment_unspent === 'number'
  ) {
    const total = stateData.comment_spent + stateData.comment_unspent
    if (total > 0) {
      highActivity = stateData.comment_spent / total > 0.8
    }
  }
  return lowRep && highActivity
}
