/**
 * Пункт «Отправить в чат» в меню «Поделиться» — общий для всех сущностей:
 * пост, комментарий, профиль, коллекция, мини-приложение, файл IPFS,
 * транзакция. Ссылку для чата строит вызывающий (share-origin `chatLinks`,
 * для файлов — ipfs-viewer), окно выбора чатов одно (share-to-chat-modal).
 */

import { computed, type ComputedRef } from 'vue'

import { useAuthStore } from '@/blockchain/store/auth-store'
import { useShareToChatStore, type ShareToChatTarget } from '@/stores/share-to-chat-store'

export function useShareToChat(): {
  /** Чаты есть только у вошедшего. */
  canShareToChat: ComputedRef<boolean>
  shareToChat: (target: ShareToChatTarget) => void
} {
  const auth = useAuthStore()
  const store = useShareToChatStore()
  return {
    canShareToChat: computed(() => !!auth.isUserAuthenticated),
    shareToChat: (target) => store.open(target),
  }
}
