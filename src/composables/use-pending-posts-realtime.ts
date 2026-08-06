/**
 * WS-подтверждение оптимистичных постов.
 *
 * Слушает событие `transaction` (приходит для транзакций с нашего/на наш адрес,
 * т.к. WS подписан на адрес пользователя) и, если тип соответствует публикации
 * поста (share/video/audio/article), снимает pending по txid. Это мгновенная
 * финализация; резервный путь — reconcileWithServer при загрузке ленты + TTL.
 *
 * Монтируется в компонентах, которые постоянно живут на экране и должны реагировать
 * на подтверждение: «песочные часы» в шапке (HeaderEvents) и лента профиля.
 *
 * Аналог use-comments-ws.ts, но глобальнее (не привязан к postId).
 */

import { onMounted, onBeforeUnmount } from 'vue'
import { wsService } from '@/blockchain/ws/ws-service'
import { usePendingPostsStore } from '@/stores'
import { isPostOpType } from '@/composables/pending-post-adapter'

export interface UsePendingPostsRealtimeOptions {
  /** Вызывается после снятия pending по подтверждённой TX (напр. рефетч ленты). */
  onConfirmed?: (txid: string) => void
}

export function usePendingPostsRealtime(opts: UsePendingPostsRealtimeOptions = {}) {
  let unsub: (() => void) | null = null

  const subscribe = () => {
    if (unsub) return
    unsub = wsService.on('transaction', (data) => {
      const type = (data?.type as string | undefined) || ''
      const txid = (data?.txid as string | undefined) || ''
      if (!txid || !isPostOpType(type)) return
      usePendingPostsStore().applyConfirmedTx(txid)
      opts.onConfirmed?.(txid)
    })
  }

  const unsubscribe = () => {
    if (unsub) {
      try {
        unsub()
      } catch {
        /* noop */
      }
      unsub = null
    }
  }

  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)
}
