/**
 * Read-receipts собеседника: до какого времени партнёр прочитал переписку.
 * Слушаем Matrix-событие `Room.receipt` на raw-клиенте (в matrix-service нет `off`),
 * считаем `getEventReadUpTo(partner)` → timestamp. Используется для галочки
 * «прочитано» на своих сообщениях. (Отправка своих receipt'ов уже есть в сторе.)
 *
 * NB: непроверяемо без живого Matrix — логика по стандартному API matrix-js-sdk.
 */

import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { matrixService } from '../../services/matrix-service'

const RECEIPT_EVENT = 'Room.receipt'

export function useReadReceipts(activeRoomId: Ref<string | null>) {
  /** Метка времени (ms) последнего прочитанного партнёром сообщения; 0 — нет данных. */
  const partnerSeenUpToTs = ref<number>(0)

  function recompute(): void {
    const rid = activeRoomId.value
    const client = matrixService.getClient()
    if (!rid || !client) {
      partnerSeenUpToTs.value = 0
      return
    }
    try {
      const room = client.getRoom?.(rid)
      if (!room) {
        partnerSeenUpToTs.value = 0
        return
      }
      const myId = client.getUserId?.()
      const partner = room
        .getJoinedMembers?.()
        ?.find((m: { userId?: string }) => m.userId && m.userId !== myId)
      if (!partner?.userId) {
        partnerSeenUpToTs.value = 0
        return
      }
      const eventId = room.getEventReadUpTo?.(partner.userId)
      if (!eventId) {
        partnerSeenUpToTs.value = 0
        return
      }
      const ev = room.findEventById?.(eventId)
      const ts = typeof ev?.getTs === 'function' ? ev.getTs() : 0
      partnerSeenUpToTs.value = Number(ts) || 0
    } catch {
      partnerSeenUpToTs.value = 0
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- сигнатура события receipt из matrix-js-sdk
  function onReceipt(_event: unknown, room: any): void {
    if (room?.roomId && room.roomId === activeRoomId.value) recompute()
  }

  watch(activeRoomId, recompute)
  onMounted(() => {
    matrixService.getClient()?.on?.(RECEIPT_EVENT, onReceipt)
    recompute()
  })
  onBeforeUnmount(() => {
    matrixService.getClient()?.off?.(RECEIPT_EVENT, onReceipt)
  })

  return { partnerSeenUpToTs }
}
