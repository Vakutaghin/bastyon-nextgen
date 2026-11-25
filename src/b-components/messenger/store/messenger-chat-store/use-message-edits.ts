// Сообщение исправили: в открытой ленте оно меняется на месте. Сама правка —
// отдельное событие, в ленту она не попадает (lib/chat-edits).

import { getEventId, getEventRoomId } from '../../helpers'
import type { Message } from '../../types'
import type { ChatContext, MxEvent } from './types'
import type { MessageMapping } from './use-message-mapping'

export function useMessageEdits(ctx: ChatContext, mapping: MessageMapping) {
  const { messages } = ctx

  /** `Event.replaced`: у исходного события сменилась правка. */
  const applyEdit = async (event: MxEvent): Promise<void> => {
    const roomId = getEventRoomId(event)
    const id = getEventId(event)
    const shown = (): Message | undefined => messages[roomId]?.find((m) => m.id === id)
    if (!shown()) return
    const fresh = await mapping.mapEventToMessage(event)
    // Пока расшифровывали, ленту могли пересобрать, а сообщение — удалить.
    const current = shown()
    const list = messages[roomId]
    if (!fresh || !current || current.deleted || !list) return
    list.splice(list.indexOf(current), 1, {
      ...fresh,
      status: current.status,
      reactions: current.reactions,
    })
  }

  return { applyEdit }
}
