// Автосохранение черновика текста поста в localStorage (только режим create).
// Ключ привязан к аккаунту (N8/Р5): раньше один `bastyon_post_draft` на
// устройство — следующий аккаунт публиковал чужой текст одним нажатием.
// Legacy-черновик без адреса переезжает к первому аккаунту, который его читает.
// Чистые функции — вынесено из use-post-composer (аудит крупных файлов 2026-08).
import { POST_DRAFT_KEY } from '@/blockchain/constants/storage'
import { accountScopedKey, adoptLegacyLocalKey } from '@/blockchain/storage/account-scoped-key'

export function postDraftKey(address: string | null | undefined): string {
  return accountScopedKey(POST_DRAFT_KEY, address)
}

export function readDraft(address: string | null | undefined): string {
  try {
    adoptLegacyLocalKey(POST_DRAFT_KEY, address)
    return localStorage.getItem(postDraftKey(address)) || ''
  } catch {
    return ''
  }
}

export function writeDraft(address: string | null | undefined, text: string): void {
  try {
    const key = postDraftKey(address)
    if (text.trim()) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    /* приватный режим — игнорируем */
  }
}
