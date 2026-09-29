/**
 * Mesh-диалоги и сообщения в виде, который рисует мессенджер: те же `Dialog` и
 * `Message`, что у Matrix, с пометкой сети.
 */

import type {
  ChatTransport,
  Dialog,
  Message,
  MessageReaction,
} from '@/b-components/messenger/types'
import type { MeshDialogRecord, MeshMessageRecord } from '@/db/types'
import { parseMeshDialogId } from '../ids'

function transportOf(dialogId: string): ChatTransport | undefined {
  return parseMeshDialogId(dialogId)?.network
}

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
    transport: transportOf(m.dialogId),
    meshReplyable: m.packetId !== undefined ? true : undefined,
  }
}

/**
 * Сообщения диалога для ленты. Реакции Meshtastic (эмодзи со ссылкой на
 * пакет) собираются на своих сообщениях, ответы ссылаются на оригинал. Реакция
 * на сообщение, которого здесь нет, показывается обычным сообщением.
 */
export function meshMessagesToMessenger(list: MeshMessageRecord[]): Message[] {
  const byPacket = new Map<number, string>()
  for (const m of list) if (m.packetId !== undefined) byPacket.set(m.packetId, m.id)

  const reactions = new Map<string, Map<string, MessageReaction>>()
  const out: Message[] = []
  for (const m of list) {
    const target = m.reactionTo !== undefined ? byPacket.get(m.reactionTo) : undefined
    if (target) {
      const forTarget = reactions.get(target) ?? new Map<string, MessageReaction>()
      const r = forTarget.get(m.text) ?? { key: m.text, count: 0 }
      r.count++
      if (m.mine) r.my = true
      forTarget.set(m.text, r)
      reactions.set(target, forTarget)
      continue
    }
    const msg = meshMessageToMessenger(m)
    const replyTo = m.replyToPacket !== undefined ? byPacket.get(m.replyToPacket) : undefined
    if (replyTo) msg.replyTo = { id: replyTo }
    out.push(msg)
  }
  if (reactions.size === 0) return out
  return out.map((msg) => {
    const r = reactions.get(msg.id)
    return r ? { ...msg, reactions: [...r.values()] } : msg
  })
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
