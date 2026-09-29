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
import type { MeshAttachment, MeshDialogRecord, MeshMessageRecord } from '@/db/types'
import {
  registerLocalMedia,
  releaseLocalMedia,
} from '@/b-components/messenger/services/local-media'
import { parseMeshDialogId } from '../ids'
import { canPlayOggOpus } from '../voice'

function transportOf(dialogId: string): ChatTransport | undefined {
  return parseMeshDialogId(dialogId)?.network
}

/** Ссылки `blob:` на байты вложений: одна на вложение, пока жив аккаунт. */
const mediaUrls = new Map<string, string>()

function mediaUrl(key: string, a: MeshAttachment): string {
  let url = mediaUrls.get(key)
  if (!url) {
    url = registerLocalMedia(new Blob([a.data as BlobPart], { type: a.mime }))
    mediaUrls.set(key, url)
  }
  return url
}

/** Выход из аккаунта: ссылки на вложения больше не нужны. */
export function forgetMeshMedia(): void {
  for (const url of mediaUrls.values()) releaseLocalMedia(url)
  mediaUrls.clear()
}

/**
 * Вложения — отдельными сообщениями перед текстом: мессенджер рисует
 * картинку, голос и файл своими компонентами. Голос (Opus в Ogg) — плеером,
 * если WebView его проиграет (WKWebView — с macOS 15, Chromium — всегда),
 * иначе файлом.
 */
function attachmentMessages(m: MeshMessageRecord, base: Message): Message[] {
  return (m.attachments ?? []).map((a, i) => {
    const key = `${m.id}#${i}`
    const type =
      a.kind === 'image' ? 'image' : a.kind === 'audio' && canPlayOggOpus() ? 'audio' : 'file'
    return {
      ...base,
      id: key,
      text: a.name,
      type,
      url: mediaUrl(key, a),
      info: { name: a.name, mimetype: a.mime, size: a.data.length },
      meshReplyable: undefined,
    }
  })
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
    if (m.attachments?.length) {
      out.push(...attachmentMessages(m, msg))
      if (!m.text) continue
    }
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

/**
 * Общий список, где у диалога Bastyon есть mesh-маршруты (`meshIdsOf` — его
 * mesh-диалоги): они в список не идут, а свежее сообщение и непрочитанные —
 * в диалог Bastyon. Человек один — и диалог с ним один.
 */
export function mergeRoutedDialogs(
  matrix: Dialog[],
  mesh: Dialog[],
  meshIdsOf: (d: Dialog) => string[]
): Dialog[] {
  if (mesh.length === 0) return matrix
  const byId = new Map(mesh.map((d) => [d.id, d]))
  const joined = new Set<string>()
  const routed = matrix.map((d) => {
    const own = meshIdsOf(d).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
    if (own.length === 0) return d
    let last = d.lastMessage
    let unread = d.unreadCount
    for (const m of own) {
      joined.add(m.id)
      unread += m.unreadCount
      if (m.lastMessage && m.lastMessage.timestamp > (last?.timestamp ?? 0)) {
        const senderId = m.lastMessage.senderId === 'me' ? 'me' : d.partner.id
        last = { ...m.lastMessage, chatId: d.id, senderId }
      }
    }
    return { ...d, unreadCount: unread, lastMessage: last }
  })
  return mergeDialogs(
    routed,
    mesh.filter((d) => !joined.has(d.id))
  )
}

/**
 * Лента диалога Bastyon вместе с сообщениями его mesh-маршрутов — по времени.
 * Входящие LXMF подписываются собеседником диалога: это он и есть.
 */
export function mergeRoutedMessages(
  matrix: Message[],
  mesh: Message[],
  partner: { id: string; name?: string }
): Message[] {
  if (mesh.length === 0) return matrix
  const own = mesh.map((m) =>
    m.senderId === 'me'
      ? m
      : { ...m, senderId: partner.id, senderName: partner.name ?? m.senderName }
  )
  return [...matrix, ...own].sort((a, b) => a.timestamp - b.timestamp)
}
