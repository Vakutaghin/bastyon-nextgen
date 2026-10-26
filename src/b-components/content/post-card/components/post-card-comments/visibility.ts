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

import { t } from '@/i18n'
import { getCommentMessageText } from './helpers'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { UserState as UserStateData } from '@/types/rpc-responses/user-state'
import type { UserProfile } from '@/types/rpc-responses/user-get'

/**
 * Порог репутации автора для скрытия комментария (legacy psdk.user.hiddenComment:
 * `ustate.reputation <= -0.5`, satolist.js:10520-10532).
 */
export const HIDE_REPUTATION_MAX = -0.5

/**
 * Минимум дизлайков, при котором низкорепутационный коммент скрывается
 * (legacy: `comment.scoreDown >= 5`).
 */
export const HIDE_MIN_SCORE_DOWN = 5

/** Порог репутации текущего пользователя ниже которого ему запрещено публиковать */
export const SELF_REP_BLOCK_THRESHOLD = -50

/**
 * Скрывать ли комментарий по репутации автора.
 *
 * Портировано 1:1 с legacy `psdk.user.hiddenComment` (satolist.js:10520-10532):
 * комментарий скрывается если репутация автора `<= -0.5` И у комментария
 * набралось `>= 5` дизлайков. Свой комментарий и удалённый — не скрываются.
 *
 * Ссылки на чужие сайты от новичков — {@link isHiddenForExternalLink}.
 */
export function isHiddenByReputation(comment: GetComment, myAddress?: string): boolean {
  if (myAddress && comment.address === myAddress) return false
  if (comment.deleted) return false
  const rep = comment.userprofile?.reputation
  if (typeof rep !== 'number') return false
  return rep <= HIDE_REPUTATION_MAX && (comment.scoreDown ?? 0) >= HIDE_MIN_SCORE_DOWN
}

/**
 * Автор поста заблокировал автора комментария. Нода помечает такие комментарии
 * `blck_cnt_cmt` (у старого клиента — первая проверка `hiddenComment`), и они
 * свёрнуты у всех читателей: блокировка закрывает комментатору дорогу под посты
 * автора и прячет то, что он написал там раньше. Сам комментатор их видит.
 */
export function isHiddenByPostAuthor(comment: GetComment, myAddress?: string): boolean {
  if (myAddress && comment.address === myAddress) return false
  if (comment.deleted) return false
  return Number(comment.blck_cnt_cmt) === 1
}

/** Ниже этой репутации ссылка на чужой сайт сворачивает комментарий (legacy: `< 20`). */
export const LINK_REPUTATION_MIN = 20

/** Ссылка или голый домен в тексте — регулярка старого клиента (`urlreg`, satolist.js). */
const LINK_PATTERN =
  /(([-a-zA-Z0-9@:%_+.~#?&/=]{2,256}\.[a-z]{2,5}\b)|(bastyon:\/))(\/[-a-zA-Z0-9@:%|_+.~#/?&=]*)?/gi

/** Свои домены: на них ссылаться можно с любой репутацией (legacy `thislink`). */
const OWN_LINK_HOSTS = ['bastyon.com', 'pocketnet.app', 'forta.chat']

function isOwnLink(link: string): boolean {
  const lower = link.toLowerCase()
  if (lower.startsWith('bastyon:/')) return true
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(lower) ? lower : `https://${lower}`)
      .hostname
    return OWN_LINK_HOSTS.some((own) => host === own || host.endsWith(`.${own}`))
  } catch {
    return false
  }
}

/**
 * Комментарий новичка со ссылкой на чужой сайт (legacy `hiddenCommentLabelLink`):
 * у автора репутация ниже {@link LINK_REPUTATION_MIN}, а в тексте есть ссылка
 * не на Bastyon. Так старый клиент гасил спам ссылками из свежих аккаунтов.
 */
export function isHiddenForExternalLink(comment: GetComment, myAddress?: string): boolean {
  if (myAddress && comment.address === myAddress) return false
  if (comment.deleted) return false
  const rep = comment.userprofile?.reputation
  if (typeof rep !== 'number' || rep >= LINK_REPUTATION_MIN) return false
  const links = getCommentMessageText(comment).match(LINK_PATTERN)
  return !!links && links.some((link) => !isOwnLink(link))
}

/**
 * Заблокирован ли автор комментария текущим пользователем.
 * `blockedSet` — список адресов из локального user-relations store; пустое
 * множество = блок-лист пока не загружен → не скрываем.
 */
export function isBlockedByMe(
  comment: GetComment,
  blockedSet?: ReadonlySet<string> | null
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
  | { kind: 'banned'; message: string }

/**
 * Может ли текущий пользователь публиковать комментарии. Возвращает причину запрета или null.
 */
export function getCommentPostingDisableReason(
  isAuthenticated: boolean,
  state: UserStateData | UserProfile | null
): DisableReason | null {
  if (!isAuthenticated) {
    return { kind: 'unauthenticated', message: t('commentsMsg.disableLoginToComment') }
  }
  if (!state) return null

  const stateData = state as UserStateData
  // Лимит на комментарии в текущем периоде
  if (typeof stateData.comment_unspent === 'number' && stateData.comment_unspent <= 0) {
    return {
      kind: 'limit-exhausted',
      message: t('commentsMsg.disableCommentLimit'),
    }
  }
  // Репутация ниже порога (упрощённый аналог reputationBlockedMe)
  const rep = (state as UserProfile).reputation
  if (typeof rep === 'number' && rep < SELF_REP_BLOCK_THRESHOLD) {
    return {
      kind: 'reputation-blocked',
      message: t('commentsMsg.disableRepComment'),
    }
  }
  return null
}

/**
 * Может ли текущий пользователь голосовать за комментарии. Возвращает причину запрета или null.
 */
export function getCommentScoringDisableReason(
  isAuthenticated: boolean,
  state: UserStateData | UserProfile | null
): DisableReason | null {
  if (!isAuthenticated) {
    return { kind: 'unauthenticated', message: t('commentsMsg.disableLoginToVote') }
  }
  if (!state) return null
  const stateData = state as UserStateData
  if (typeof stateData.comment_score_unspent === 'number' && stateData.comment_score_unspent <= 0) {
    return { kind: 'limit-exhausted', message: t('commentsMsg.disableScoreLimit') }
  }
  const rep = (state as UserProfile).reputation
  if (typeof rep === 'number' && rep < SELF_REP_BLOCK_THRESHOLD) {
    return { kind: 'reputation-blocked', message: t('commentsMsg.disableRepScore') }
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
