// Персист черновика корневого комментария (composer к посту) в localStorage,
// ключом по postId. Черновики ответов на ветки эфемерны и не пишутся. Чистые
// функции — вынесено из use-comment-form (см. LARGE_FILE_SPLIT_AUDIT.md).
export function commentDraftKey(postId: string): string {
  return `bastyon_comment_draft:${postId}`
}

export function readCommentDraft(postId: string): string {
  try {
    return localStorage.getItem(commentDraftKey(postId)) || ''
  } catch {
    return ''
  }
}

export function writeCommentDraft(postId: string, text: string): void {
  try {
    if (text.trim()) localStorage.setItem(commentDraftKey(postId), text)
    else localStorage.removeItem(commentDraftKey(postId))
  } catch {
    /* приватный режим — молча игнорируем */
  }
}

export function clearCommentDraft(postId: string): void {
  try {
    localStorage.removeItem(commentDraftKey(postId))
  } catch {
    /* noop */
  }
}
