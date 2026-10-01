/**
 * Галочки «✓✓» на своих сообщениях открытого чата: какие из них уже прочитали.
 * Квитанции хранит matrix-js-sdk, а расчёт — в read-receipts.ts. Пересчёт —
 * когда пришла квитанция (счётчик в чат-сторе, слушатель в
 * use-matrix-listeners) и когда меняется лента: подгрузили историю, своё
 * сообщение дошло до сервера, собеседник ответил.
 */

import { computed, type ComputedRef, type Ref } from 'vue'

import { matrixService } from '../../services/matrix-service'
import { useMessengerChatStore } from '../../store/messenger-chat-store'
import { seenMessageIds, type ReceiptRoom } from '../../store/messenger-chat-store/read-receipts'

const NOTHING: ReadonlySet<string> = new Set()

export function useReadReceipts(activeRoomId: Ref<string | null>): {
  seenIds: ComputedRef<ReadonlySet<string>>
} {
  const chatStore = useMessengerChatStore()

  const seenIds = computed<ReadonlySet<string>>(() => {
    const roomId = activeRoomId.value
    if (!roomId) return NOTHING
    void chatStore.receiptsVersion[roomId]
    const messages = chatStore.messages[roomId]
    if (!messages?.length) return NOTHING
    const client = matrixService.getClient()
    const room = client?.getRoom?.(roomId) as ReceiptRoom | null | undefined
    const myUserId = client?.getUserId?.()
    if (!room || !myUserId) return NOTHING
    const meId = chatStore.currentUser.id
    try {
      return seenMessageIds(
        room,
        myUserId,
        messages,
        (m) => m.senderId === myUserId || m.senderId === meId || m.senderId === 'me'
      )
    } catch {
      return NOTHING
    }
  })

  return { seenIds }
}
