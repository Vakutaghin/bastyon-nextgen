/**
 * Real-time обновление эксплорера через WebSocket.
 *
 * Подписывается на событие `'block'` от ws-service и инвалидирует Vue Query
 * ключи, привязанные к tip-у: node-info, coin-info, last-blocks (любой count).
 * Это эквивалент refetchInterval-а, но мгновенный — UI обновляется ровно
 * тогда, когда нода присылает блок.
 *
 * Детали блока инвалидируем тоже (N31): у блока-вершины поле `nexthash` пустое
 * ровно до появления следующего блока, а `staleTime` исторических данных —
 * сутки, поэтому без инвалидации «Следующий блок» не появлялся до перезагрузки
 * страницы. Обновляется только активный (открытый) запрос — это один блок.
 *
 * Детали tx и адреса НЕ инвалидируем: они привязаны к txid/адресу и сами не
 * меняются, а confirmations пересчитываются через computed от tipHeight.
 *
 * Если WS ещё не подключён, инициируем connect(). Не закрываем на unmount —
 * соединение разделяемое с остальным приложением.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { wsService } from '@/blockchain/ws/ws-service'

export interface ExplorerWsState {
  /** Текущий статус подключения WebSocket. */
  isConnected: import('vue').Ref<boolean>
  /** Unix-секунды последнего полученного блок-события (0 пока ничего не было). */
  lastBlockAt: import('vue').Ref<number>
}

export function useExplorerWsUpdates(): ExplorerWsState {
  const queryClient = useQueryClient()
  const isConnected = ref(wsService.isConnected)
  const lastBlockAt = ref(0)

  const unsubscribers: Array<() => void> = []

  function invalidateTipQueries() {
    queryClient.invalidateQueries({ queryKey: ['explorer', 'node-info'] })
    queryClient.invalidateQueries({ queryKey: ['explorer', 'coin-info'] })
    // last-blocks ключ — ['explorer', 'last-blocks', N], invalidateQueries матчит по префиксу.
    queryClient.invalidateQueries({ queryKey: ['explorer', 'last-blocks'] })
    // N31: у открытого блока мог появиться `nexthash`. Префикс ['explorer','block']
    // не задевает 'block-transactions' — это другой элемент ключа.
    queryClient.invalidateQueries({ queryKey: ['explorer', 'block'] })
  }

  onMounted(() => {
    unsubscribers.push(
      wsService.on('open', () => {
        isConnected.value = true
      }),
      wsService.on('close', () => {
        isConnected.value = false
      }),
      wsService.on('block', () => {
        lastBlockAt.value = Math.floor(Date.now() / 1000)
        invalidateTipQueries()
      })
    )

    // Connect WS if not already (works for guests too — node broadcasts 'new block'
    // events to any connected client, without requiring address subscription).
    if (!wsService.isConnected) {
      void wsService.connect()
    } else {
      isConnected.value = true
    }
  })

  onBeforeUnmount(() => {
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers.length = 0
    // Не закрываем wsService — он singleton, может использоваться auth/messenger.
  })

  return { isConnected, lastBlockAt }
}
