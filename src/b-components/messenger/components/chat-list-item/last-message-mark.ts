// Галочка у своего последнего сообщения в строке списка — та же, что у времени
// сообщения в переписке (delivery-mark.ts): «…» отправляется, «✓» дошло до
// сервера, «✓✓» прочитано, а в mesh — подтвердило радио собеседника.

import { parseMeshDialogId } from '@/mesh/ids'
import { isMeshTransport, type Message } from '../../types'
import { deliveryMark, type DeliveryMark } from '../message-item/delivery-mark'

/**
 * Отметка своего сообщения; `seen` — его прочитали (квитанции Matrix). Не
 * отправленное отметки не получает: у него своя «!».
 */
export function lastMessageMark(
  message: Pick<Message, 'id' | 'chatId' | 'status' | 'transport'>,
  seen: boolean,
  t: (key: string) => string
): DeliveryMark | null {
  // До ответа сервера у своего события временный id `~…`, а статус в списке — «sent».
  const status =
    message.status === 'sent' && message.id.startsWith('~') ? 'sending' : message.status
  const mesh = isMeshTransport(message.transport)
  return deliveryMark(
    {
      status,
      transport: message.transport,
      mine: true,
      seen,
      mesh,
      meshKind: mesh ? (parseMeshDialogId(message.chatId)?.kind ?? null) : null,
    },
    t
  )
}
