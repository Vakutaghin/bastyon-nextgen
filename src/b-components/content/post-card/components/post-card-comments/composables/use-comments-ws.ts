/**
 * WebSocket подписка на realtime обновления комментариев:
 * - comment/commentEdit/commentDelete — снимаем pending по txid и рефрешим список
 * - cScore — лайки/дизлайки чужих коммов, рефрешим, чтобы обновить scoreUp/Down
 *
 * Рефреш дебаунсится (600ms), чтобы пачки WS-событий не штормили getcomments.
 */

import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { wsService } from '@/blockchain/ws/ws-service'
import { useCommentsStore } from '@/stores'

export interface UseCommentsWsOptions {
  postId: Ref<string>
  isLoading: Ref<boolean>
  hasLoaded: Ref<boolean>
  isCollapsed: Ref<boolean>
  reload: () => Promise<void> | void
}

export function useCommentsWs(opts: UseCommentsWsOptions) {
  let wsUnsub: (() => void) | null = null
  let refreshDebounce: number | null = null

  const scheduleRefresh = () => {
    if (refreshDebounce !== null) return
    refreshDebounce = window.setTimeout(() => {
      refreshDebounce = null
      // Перезагружаем только если список уже был открыт хоть раз — иначе
      // нет смысла нагружать сеть для свёрнутого превью.
      if (opts.hasLoaded.value && !opts.isCollapsed.value) {
        void opts.reload()
      }
    }, 600)
  }

  const subscribe = () => {
    if (wsUnsub) return
    wsUnsub = wsService.on('transaction', (data) => {
      // data.txid и data.type приходят от прокси; игнорируем шум, нас интересуют
      // транзакции, относящиеся к нашему посту: comment / commentEdit / commentDelete / cScore.
      const type = (data?.type as string | undefined) || ''
      if (!opts.postId.value) return

      const txid = (data?.txid as string | undefined) || ''
      const store = useCommentsStore()

      // В WS-событии `type` — это mesType уведомления (post, answer, …), а не
      // тип операции комментария, поэтому по типу подтверждение не ловилось.
      // Матчим по txid своей транзакции (S19).
      if (txid && store.hasPendingTx(opts.postId.value, txid)) {
        store.applyConfirmedTx(opts.postId.value, txid, type || undefined)
        scheduleRefresh()
        return
      }

      if (!type) return

      if (type === 'comment' || type === 'commentEdit' || type === 'commentDelete') {
        if (txid) store.applyConfirmedTx(opts.postId.value, txid, type)
        scheduleRefresh()
        return
      }

      if (type === 'cScore') {
        scheduleRefresh()
        return
      }
    })
  }

  const unsubscribe = () => {
    if (wsUnsub) {
      try {
        wsUnsub()
      } catch {
        /* noop */
      }
      wsUnsub = null
    }
  }

  /** Ручной refresh — кнопка в шапке списка */
  const refresh = () => {
    if (opts.isLoading.value) return
    void opts.reload()
  }

  onMounted(subscribe)
  onBeforeUnmount(() => {
    unsubscribe()
    if (refreshDebounce !== null) {
      clearTimeout(refreshDebounce)
      refreshDebounce = null
    }
  })

  return {
    refresh,
    scheduleRefresh,
  }
}
