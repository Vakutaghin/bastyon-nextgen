/**
 * Mesh-диалоги и сообщения в виде, который рисует мессенджер: те же `Dialog` и
 * `Message`, что у Matrix, с пометкой сети.
 */

import type { Dialog, Message } from '@/b-components/messenger/types'
import type { MeshDialogRecord, MeshMessageRecord } from '@/db/types'

export function meshMessageToMessenger(m: MeshMessageRecord): Message {
  return {
    id: m.id,
    chatId: m.dialogId,
    senderId: m.mine ? 'me' : m.senderId,
    senderName: m.senderName ?? undefined,
    text: m.text,
    type: 'text',
    timestamp: m.ts,
    read: true,
    status: m.status === 'received' ? 'sent' : m.status,
    transport: m.dialogId.startsWith('mesh:') ? 'meshcore' : undefined,
  }
}

export function meshDialogToMessenger(d: MeshDialogRecord): Dialog {
  return {
    id: d.id,
    partner: { id: d.id, name: d.name },
    unreadCount: d.unread,
    lastMessage:
      d.lastTs > 0
        ? {
            id: `${d.id}|last`,
            chatId: d.id,
            senderId: d.lastMine ? 'me' : d.id,
            text: d.lastText,
            type: 'text',
            timestamp: d.lastTs,
            read: true,
            status: 'sent',
            transport: d.network,
          }
        : undefined,
    createdAt: Math.floor(d.createdAt / 1000),
    transport: d.network,
    meshKind: d.kind,
    channelKind: d.channelKind,
  }
}

/** Когда в диалоге что-то было: последнее сообщение, иначе создание (мс). */
export function dialogActivity(d: Dialog): number {
  return d.lastMessage?.timestamp ?? (d.createdAt ?? 0) * 1000
}

/** Общий список: Matrix и mesh вперемешку, свежие сверху. */
export function mergeDialogs(matrix: Dialog[], mesh: Dialog[]): Dialog[] {
  if (mesh.length === 0) return matrix
  return [...matrix, ...mesh].sort((a, b) => dialogActivity(b) - dialogActivity(a))
}
