// Автосохранение черновика текста поста в localStorage (только режим create).
// Чистые функции — вынесено из use-post-composer (см. LARGE_FILE_SPLIT_AUDIT.md).
const DRAFT_KEY = 'bastyon_post_draft'

export function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) || ''
  } catch {
    return ''
  }
}

export function writeDraft(text: string): void {
  try {
    if (text.trim()) localStorage.setItem(DRAFT_KEY, text)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* приватный режим — игнорируем */
  }
}
