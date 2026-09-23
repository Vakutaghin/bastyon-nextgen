/**
 * WS-подтверждение оптимистичных постов.
 *
 * Слушает событие `transaction` (приходит для транзакций с нашего/на наш адрес,
 * т.к. WS подписан на адрес пользователя) и снимает pending по txid. Матч идёт
 * ИМЕННО по txid: в WS-событии `type` — это `mesType` уведомления (post, answer,
 * upvoteShare, …), а не тип операции публикации, поэтому проверка
 * `type ∈ {share,video,audio,article}` не срабатывала никогда (S19). Резервный
 * путь остаётся: reconcileWithServer при загрузке ленты + TTL.
 *
 * Монтируется в компонентах, которые постоянно живут на экране и должны реагировать
 * на подтверждение: «песочные часы» в шапке (HeaderEvents) и лента профиля.
 *
 * Аналог use-comments-ws.ts, но глобальнее (не привязан к postId).
 */

import { onMounted, onBeforeUnmount } from 'vue'
import { wsService } from '@/blockchain/ws/ws-service'
import { usePendingPostsStore } from '@/stores'

export interface UsePendingPostsRealtimeOptions {
  /** Вызывается после снятия pending по подтверждённой TX (напр. рефетч ленты). */
  onConfirmed?: (txid: string) => void
}

export function usePendingPostsRealtime(opts: UsePendingPostsRealtimeOptions = {}) {
  let unsub: (() => void) | null = null

  const subscribe = () => {
    if (unsub) return
    unsub = wsService.on('transaction', (data) => {
      const txid = (data?.txid as string | undefined) || ''
      if (!txid) return
      const store = usePendingPostsStore()
      if (!store.hasPendingTx(txid)) return
      store.applyConfirmedTx(txid)
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
