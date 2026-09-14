// Автосохранение черновика текста поста в localStorage (только режим create).
// Чистые функции — вынесено из use-post-composer (аудит крупных файлов 2026-08).
import { POST_DRAFT_KEY } from '@/blockchain/constants/storage'

const DRAFT_KEY = POST_DRAFT_KEY

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
