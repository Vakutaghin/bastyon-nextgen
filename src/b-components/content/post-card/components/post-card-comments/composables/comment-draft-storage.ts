// Персист черновика корневого комментария (composer к посту) в localStorage,
// ключом по аккаунту и postId (N10/Р5): раньше `bastyon_comment_draft:<postId>`
// был общим на устройство. Legacy-ключ без адреса переезжает к первому
// аккаунту, который его читает. Черновики ответов на ветки эфемерны и не
// пишутся. Чистые функции — вынесено из use-comment-form (аудит крупных файлов 2026-08).
import { COMMENT_DRAFT_PREFIX } from '@/blockchain/constants/storage'

/** Legacy-ключ (до привязки к аккаунту) — источник миграции. */
function legacyKey(postId: string): string {
  return `${COMMENT_DRAFT_PREFIX}${postId}`
}

export function commentDraftKey(address: string | null | undefined, postId: string): string {
  return address ? `${COMMENT_DRAFT_PREFIX}${address}:${postId}` : legacyKey(postId)
}

function adoptLegacy(address: string | null | undefined, postId: string): void {
  if (!address) return
  try {
    const scoped = commentDraftKey(address, postId)
    if (localStorage.getItem(scoped) !== null) return
    const legacy = localStorage.getItem(legacyKey(postId))
    if (legacy === null) return
    localStorage.setItem(scoped, legacy)
    localStorage.removeItem(legacyKey(postId))
  } catch {
    /* noop */
  }
}

export function readCommentDraft(address: string | null | undefined, postId: string): string {
  try {
    adoptLegacy(address, postId)
    return localStorage.getItem(commentDraftKey(address, postId)) || ''
  } catch {
    return ''
  }
}

export function writeCommentDraft(
  address: string | null | undefined,
  postId: string,
  text: string
): void {
  try {
    const key = commentDraftKey(address, postId)
    if (text.trim()) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    /* приватный режим — молча игнорируем */
  }
}

export function clearCommentDraft(address: string | null | undefined, postId: string): void {
  try {
    localStorage.removeItem(commentDraftKey(address, postId))
  } catch {
    /* noop */
  }
}
