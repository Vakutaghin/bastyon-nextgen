/**
 * Отметка у времени своего сообщения.
 *
 * Matrix: «…» — отправляется, «✓» — дошло до сервера, «✓✓» — прочитано
 * (см. store/messenger-chat-store/read-receipts.ts). Mesh — путь по эфиру:
 * отправляется, ушло в эфир, радио собеседника подтвердило (прочтений в эфире
 * нет). Не отправленное показывает «Не отправлено» отдельной строкой.
 */

import type { MeshDialogKind } from '@/mesh/ids'
import type { Message } from '../../types'

export interface DeliveryMark {
  mark: string
  title: string
  /** Конечное состояние: прочитано (Matrix) или подтверждено радио (mesh). */
  done: boolean
}

export interface DeliveryMarkInput {
  status: Message['status']
  transport: Message['transport']
  mine: boolean
  /** Прочитано собеседником (Matrix). */
  seen: boolean
  /** Сообщение ушло по радио (mesh), а не через Matrix. */
  mesh: boolean
  /** Вид mesh-диалога; null — mesh-маршрут внутри диалога Bastyon. */
  meshKind: MeshDialogKind | null
}

export function deliveryMark(
  input: DeliveryMarkInput,
  t: (key: string) => string
): DeliveryMark | null {
  const { status, transport, mine, seen, mesh, meshKind } = input
  if (!mine || status === 'failed') return null

  if (mesh) {
    switch (status) {
      case 'sending':
        return { mark: '…', title: t('mesh.chat.sending'), done: false }
      case 'sent':
        return {
          mark: '✓',
          title: transport === 'lxmf' ? t('mesh.chat.lxmfSent') : t('mesh.chat.sent'),
          done: false,
        }
      case 'delivered':
        // В канале Meshtastic подтверждения от адресата нет: «✓✓» — ретранслировали.
        return {
          mark: '✓✓',
          title:
            meshKind === 'channel'
              ? t('mesh.chat.relayed')
              : meshKind === 'room'
                ? t('mesh.chat.roomDelivered')
                : transport === 'lxmf'
                  ? t('mesh.chat.lxmfDelivered')
                  : t('mesh.chat.delivered'),
          done: true,
        }
      default:
        return null
    }
  }

  if (status === 'sending') return { mark: '…', title: t('messenger.markSending'), done: false }
  if (seen || status === 'read') return { mark: '✓✓', title: t('messenger.seen'), done: true }
  return { mark: '✓', title: t('messenger.markSent'), done: false }
}
