// Неотправленные сообщения. Чат-сервер не принял сообщение — оно остаётся в
// ленте с «Повторить», и для повтора нужно то, что отправляли: текст лежит в
// самом сообщении, а голосовое, фото, видео и файл — здесь, в памяти. Раньше
// вложение после неудачи терялось, и «Повторить» у голосового ничего не
// делало. На устройстве неотправленное хранится зашифрованным ключом аккаунта
// и после перезапуска возвращается в ленту, а не пропадает.

import { chatOutboxAPI } from '@/db/apis/chat-outbox-api'
import type { ChatOutboxRecord } from '@/db/types'
import {
  deriveArchiveKey,
  openBytes,
  openJson,
  sealBytes,
  sealJson,
} from '../../lib/archive-crypto'
import { registerLocalMedia, releaseLocalMedia } from '../../services/local-media'
import type { Message } from '../../types'
import type { MessagesByChat } from './media-sending-helpers'

/** Что нужно, чтобы отправить вложение снова. */
export interface MediaPayload {
  kind: 'audio' | 'image' | 'video' | 'file'
  blob: Blob
  name?: string
  /** Длительность голосового или видео, с. */
  duration?: number
  /** Обложка видео. */
  poster?: Blob | null
}

/**
 * Вложение больше — на устройстве не храним: шифровать его целиком в памяти
 * тяжело. Такое неотправленное живёт до закрытия приложения.
 */
export const OUTBOX_BLOB_LIMIT = 25 * 1024 * 1024

/** Что лежит в записи под шифром: сообщение без ссылок и прогресса, описание вложения. */
interface StoredMessage {
  message: Omit<Message, 'url' | 'status'>
  payload?: Omit<MediaPayload, 'blob' | 'poster'> & { mimetype: string; posterType?: string }
}

export interface Outbox {
  /** Открыть неотправленное аккаунта и вернуть его в ленты чатов. */
  attach(account: string, privateKey: ArrayLike<number>): Promise<void>
  /** Выход из аккаунта: вложения в памяти отпускаем, на устройстве всё остаётся. */
  detach(): void
  /** Вложение отправляющегося сообщения — на случай повтора. */
  hold(id: string, payload: MediaPayload): void
  payload(id: string): MediaPayload | undefined
  /** Сообщение не ушло: сохранить на устройстве. */
  keep(message: Message): Promise<void>
  /** Ушло или удалено: забыть. */
  forget(id: string): Promise<void>
}

/** Ссылка на вложение для ленты: голосовому плееру Blob нужен целиком (local-media). */
export function mediaUrl(payload: MediaPayload): string | undefined {
  if (payload.kind === 'audio') return registerLocalMedia(payload.blob)
  if (payload.kind === 'file') return undefined
  return URL.createObjectURL(payload.blob)
}

/** Отпустить ссылки сообщения на вложение и обложку. */
export function releaseMediaUrls(message: Pick<Message, 'url' | 'info' | 'type'>): void {
  const urls = [message.url, message.info?.posterUrl ?? undefined]
  for (const url of urls) {
    if (typeof url !== 'string' || !url.startsWith('blob:')) continue
    if (message.type === 'audio') releaseLocalMedia(url)
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ссылка уже отпущена */
    }
  }
}

export function createOutbox(messages: MessagesByChat): Outbox {
  const payloads = new Map<string, MediaPayload>()
  let account = ''
  let key: CryptoKey | null = null
  let generation = 0
  /** Последний keep каждого сообщения: forget или новый keep отменяют прежнюю запись. */
  const keeping = new Map<string, number>()
  let keepSeq = 0

  async function restore(record: ChatOutboxRecord, run: number): Promise<void> {
    if (!key) return
    const stored = await openJson<StoredMessage>(key, { iv: record.iv, data: record.data })
    if (!stored || run !== generation) return
    const message: Message = { ...stored.message, status: 'failed' }
    if (message.info) delete message.info.uploadProgress
    if (stored.payload) {
      if (!record.blob) return
      const bytes = await openBytes(key, record.blob)
      if (!bytes || run !== generation) return
      const posterBytes = record.poster ? await openBytes(key, record.poster) : null
      const { mimetype, posterType, ...meta } = stored.payload
      const payload: MediaPayload = {
        ...meta,
        blob: new Blob([bytes as BlobPart], { type: mimetype }),
        poster: posterBytes ? new Blob([posterBytes as BlobPart], { type: posterType }) : null,
      }
      payloads.set(message.id, payload)
      message.url = mediaUrl(payload)
      if (payload.poster)
        message.info = { ...message.info, posterUrl: URL.createObjectURL(payload.poster) }
    }
    const list = messages[record.chatId] ?? (messages[record.chatId] = [])
    if (list.some((m) => m.id === message.id)) return
    list.push(message)
    list.sort((a, b) => a.timestamp - b.timestamp)
  }

  return {
    async attach(nextAccount, privateKey) {
      const run = ++generation
      account = nextAccount
      key = null
      const nextKey = await deriveArchiveKey(privateKey, 'outbox-v1')
      const records = await chatOutboxAPI.all(nextAccount)
      if (run !== generation) return
      key = nextKey
      for (const record of records.sort((a, b) => a.ts - b.ts)) {
        await restore(record, run).catch(() => {})
      }
    },

    detach() {
      generation++
      account = ''
      key = null
      payloads.clear()
    },

    hold(id, payload) {
      payloads.set(id, payload)
    },

    payload(id) {
      return payloads.get(id)
    },

    async keep(message) {
      if (!key || !account) return
      const token = ++keepSeq
      keeping.set(message.id, token)
      const payload = payloads.get(message.id)
      if (payload && payload.blob.size > OUTBOX_BLOB_LIMIT) return
      // Ссылки `blob:` и статус после перезапуска ничего не значат.
      const rest: StoredMessage['message'] = { ...message }
      delete (rest as Partial<Message>).url
      delete (rest as Partial<Message>).status
      const stored: StoredMessage = {
        message: { ...rest, info: rest.info ? { ...rest.info, posterUrl: undefined } : undefined },
      }
      if (stored.message.info) delete stored.message.info.uploadProgress
      if (payload) {
        const { blob, poster, ...meta } = payload
        stored.payload = {
          ...meta,
          mimetype: blob.type,
          ...(poster ? { posterType: poster.type } : {}),
        }
      }
      const run = generation
      const sealedKey = key
      const record: ChatOutboxRecord = {
        account,
        id: message.id,
        chatId: message.chatId,
        ts: message.timestamp,
        ...(await sealJson(sealedKey, stored)),
      }
      if (payload) {
        record.blob = await sealBytes(sealedKey, new Uint8Array(await payload.blob.arrayBuffer()))
        if (payload.poster) {
          record.poster = await sealBytes(
            sealedKey,
            new Uint8Array(await payload.poster.arrayBuffer())
          )
        }
      }
      // Пока шифровали, аккаунт сменили или сообщение уже отправляют снова.
      if (run !== generation || keeping.get(message.id) !== token) return
      keeping.delete(message.id)
      await chatOutboxAPI.put(record)
    },

    async forget(id) {
      payloads.delete(id)
      keeping.delete(id)
      if (account) await chatOutboxAPI.remove(account, id)
    },
  }
}
