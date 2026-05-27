/**
 * Чистые computed-функции для списка комментариев: сборка sortedComments
 * с pending-вставками, список mention-кандидатов из комментов и lastComment.
 */

import type { GetComment } from '@/types/rpc-responses/get-comments'
import { sortComments } from '../helpers'
import { isHiddenByReputation as visIsHiddenByReputation } from '../visibility'
import { MENTION_LIST_LIMIT } from '../consts'
import type { CommentsSortOrder, MentionUser, PostForComments } from '../types'

/**
 * Sorted-комменты с учётом pending и эвристики «низкая репутация = вниз».
 * Pending корневые приклеиваются в общий список — UI рисует через единый sortedComments.
 */
export function buildSortedComments(
  realComments: GetComment[] | null,
  pendingRoots: GetComment[],
  sortOrder: CommentsSortOrder,
  myAddress: string | undefined,
  postAuthorAddress: string | undefined
): GetComment[] {
  const real = realComments ?? []
  const all = [...real, ...pendingRoots]
  if (!all.length) return []

  // Карта репутаций авторов из ответа getcomments — для дешёвой проверки в isBlocked.
  // (Скрытые-по-репутации идут в самый низ через обнуление веса в commentPoint.)
  const lowRepAuthors = new Set<string>()
  for (const c of all) {
    if (visIsHiddenByReputation(c, myAddress)) {
      lowRepAuthors.add(c.address)
    }
  }
  return sortComments(all, sortOrder, {
    myAddress,
    postAuthorAddress,
    // Эвристический isBlocked: пока user-relations store нет, единственный
    // надёжный сигнал «не показывать наверх» — низкая репутация автора.
    isBlocked: (address) => lowRepAuthors.has(address),
    // isVerified / getActivityPoint — TBD (нужен activity / verified сигнал из API).
  })
}

/**
 * Собирает уникальных пользователей для @mention-меню: из lastComment, всех
 * загруженных корневых комментов и развёрнутых ответов.
 */
export function buildMentionUsers(
  post: PostForComments,
  allComments: GetComment[] | null,
  repliesByParentId: Record<string, GetComment[]>
): MentionUser[] {
  const byAddress = new Map<string, string>()
  const add = (c: GetComment) => {
    if (!c?.address) return
    const name = (c.userprofile?.name || c.address || '').trim() || c.address
    if (!byAddress.has(c.address)) byAddress.set(c.address, name)
  }
  const lc = post.lastComment
  if (lc?.address) {
    const name = (lc.authorName || lc.address || '').trim() || lc.address
    if (!byAddress.has(lc.address)) byAddress.set(lc.address, name)
  }
  if (allComments) {
    for (const c of allComments) add(c)
  }
  for (const list of Object.values(repliesByParentId)) {
    if (Array.isArray(list)) for (const c of list) add(c)
  }
  return Array.from(byAddress.entries()).map(([address, name]) => ({ address, name }))
}

/** Фильтрует mention-список по запросу с лимитом {@link MENTION_LIST_LIMIT}. */
export function filterMentionUsers(users: MentionUser[], query: string): MentionUser[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return users.slice(0, MENTION_LIST_LIMIT)
  return users
    .filter(
      (u) => (u.name || '').toLowerCase().includes(q) || (u.address || '').toLowerCase().includes(q)
    )
    .slice(0, MENTION_LIST_LIMIT)
}
