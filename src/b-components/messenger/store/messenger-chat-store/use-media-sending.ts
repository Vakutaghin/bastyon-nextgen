// Отправка медиа-вложений (аудио/изображения/видео/файлы): оптимистичное
// сообщение → шифрование per-message ключом → загрузка через matrixService.
// В публичную группу и группу от 50 участников вложение уходит открыто, как
// у прежнего клиента и как текст (encryption-rule). Текстовые сообщения и
// реакции — в use-message-sending.

import { matrixService } from '../../services/matrix-service'
import { encryptAudioBlob, sealWaveform } from '../../services/encryption-service'
import { decodeVoice, hasWaveformShape, waveformToInfo } from '../../lib/voice-waveform'
import { encryptBlobWithRandomKey, wrapKeyForRoom } from '../../services/media-encrypt'
import {
  extractImageDimensions,
  extractVideoMetadata,
  prepareChatPhoto,
  stripPhotoMetadata,
} from '../../services/media-metadata'
import { isTetatetchat } from '../../helpers'
import { DEFAULT_ENCRYPTION_BLOCK } from '../consts'
import type { Message } from '../../types'
import type { ChatContext } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import { roomEncrypts } from './encryption-rule'
import {
  createProgressHandler,
  makeTempId,
  markSendingFailed,
  pushOptimistic,
  removeOptimistic,
} from './media-sending-helpers'
import { createOutbox, mediaUrl, releaseMediaUrls, type MediaPayload, type Outbox } from './outbox'
import { txnState } from './txn-state'

// Лимиты согласованы с bastyon-chat (input/index.js:141, 163): фото — 100 МБ, файлы — 25 МБ.
// Тот же лимит применяется к видео (которые сейчас уходят как m.file).
/** Больше в чат не отправить: чат-сервер не примет. Больше файла — через IPFS. */
export const IMAGE_SIZE_LIMIT_BYTES = 100 * 1024 * 1024
export const FILE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024

/** Что загрузить: файл как есть или зашифрованный, с ключами для участников. */
interface SealedMedia {
  blob: Blob
  size: number
  secrets?: Awaited<ReturnType<typeof wrapKeyForRoom>>
  block?: number
}

export function useMediaSending(
  ctx: ChatContext,
  chatCrypto: ChatCrypto,
  outbox: Outbox = createOutbox(ctx.messages)
) {
  const { messages, currentUser, uiStore } = ctx
  const {
    ensurePcryptoInitialized,
    waitForPcrypto,
    pcryptoService,
    getOrderedMemberIds,
    collectPcryptoUsers,
    getCurrentBlockHeight,
    pickRoomBlock,
  } = chatCrypto

  /**
   * Общий preflight: клиент поднят, pcrypto инициализирован (или дожидаемся
   * во время init), комната есть и участники подгружены.
   */
  const prepareRoom = async (
    chatId: string
  ): Promise<NonNullable<ReturnType<typeof matrixService.getRoom>>> => {
    const client = matrixService.getClient()
    if (!client) throw new Error('Matrix client not initialized')

    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

    const room = matrixService.getRoom(chatId)
    if (!room) throw new Error('Room not found')
    await room.loadMembersIfNeeded?.()
    return room
  }

  /**
   * Фото, видео, файл: шифруем случайным ключом, ключ — участникам. В открытую
   * группу — файл как есть: ключи на сотни человек прежний клиент не делал, и
   * его участники открытое вложение и ждут.
   */
  const sealForRoom = async (
    room: NonNullable<ReturnType<typeof matrixService.getRoom>>,
    timestamp: number,
    file: Blob
  ): Promise<SealedMedia> => {
    const memberIds = getOrderedMemberIds(room, timestamp)
    if (!roomEncrypts(room, memberIds)) return { blob: file, size: file.size }
    const users = await collectPcryptoUsers(memberIds)
    const block = await pickRoomBlock(room)
    const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(file)
    const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)
    return { blob: encryptedBlob, size: encryptedBlob.size, secrets, block }
  }

  const find = (chatId: string, id: string): Message | undefined =>
    messages[chatId]?.find((m) => m.id === id)

  /**
   * Загрузить вложение и отправить событие. Шифрование — по составу комнаты на
   * момент отправки: при повторе в чат могли прийти или уйти люди.
   */
  const deliver = async (chatId: string, id: string, payload: MediaPayload): Promise<void> => {
    // Одна транзакция на все попытки (у записей до txnId — с этой попытки):
    // сообщение, которое на деле дошло, повтор не задвоит (txn-state).
    const earlier = payload.txnId
    const txnId = (payload.txnId ??= matrixService.makeTxnId())
    const state = earlier ? txnState(chatId, earlier) : null
    if (state?.kind === 'delivered') return
    if (state?.kind === 'pending') throw new Error('media message is still being sent')
    if (state?.kind === 'unsent') {
      // Вложение уже загружено, событие собрано: SDK повторяет его как есть.
      await state.resend()
      return
    }

    const room = await prepareRoom(chatId)
    const onProgress = createProgressHandler(messages, chatId, id)
    const info = find(chatId, id)?.info
    const now = Date.now()
    const mimetype = payload.blob.type
    const name = payload.name || payload.kind

    switch (payload.kind) {
      case 'audio': {
        const memberIds = getOrderedMemberIds(room, now)
        const audio = {
          txnId,
          name,
          mimetype: mimetype || 'audio/webm',
          duration: payload.duration || 0,
        }
        // Волна — по самой записи (плеер своего голосового её уже разобрал).
        const samples = (await decodeVoice(payload.blob))?.samples
        const wave = samples && hasWaveformShape(samples) ? samples : undefined
        if (!roomEncrypts(room, memberIds)) {
          await matrixService.sendAudio(
            chatId,
            {
              ...audio,
              blob: payload.blob,
              size: payload.blob.size,
              ...(wave ? { waveform: waveformToInfo(wave) } : {}),
            },
            onProgress
          )
          return
        }
        const users = await collectPcryptoUsers(memberIds)
        const block = isTetatetchat(room)
          ? DEFAULT_ENCRYPTION_BLOCK
          : (await getCurrentBlockHeight()) || DEFAULT_ENCRYPTION_BLOCK
        const { encryptedBlob, secretStr } = await encryptAudioBlob(payload.blob)
        const version = 2
        const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)
        const waveformEncrypted = wave ? await sealWaveform(wave, secretStr) : undefined
        await matrixService.sendAudio(
          chatId,
          {
            ...audio,
            blob: encryptedBlob,
            size: encryptedBlob.size,
            secrets,
            block,
            ...(waveformEncrypted ? { waveformEncrypted } : {}),
          },
          onProgress
        )
        return
      }
      case 'image': {
        const sealed = await sealForRoom(room, now, payload.blob)
        await matrixService.sendImage(
          chatId,
          {
            ...sealed,
            txnId,
            name,
            mimetype: mimetype || 'image/jpeg',
            width: info?.w,
            height: info?.h,
          },
          onProgress
        )
        return
      }
      case 'video': {
        const poster = payload.poster
        const [posterMxcUrl, sealed] = await Promise.all([
          poster
            ? matrixService
                .uploadContent(poster, { name: 'poster.jpg', type: 'image/jpeg' })
                .catch(() => null)
            : Promise.resolve(null),
          sealForRoom(room, now, payload.blob),
        ])
        await matrixService.sendVideo(
          chatId,
          {
            ...sealed,
            txnId,
            name,
            mimetype: mimetype || 'video/mp4',
            duration: payload.duration,
            width: info?.w || undefined,
            height: info?.h || undefined,
            thumbnailUrl: posterMxcUrl || undefined,
            thumbnailMimetype: poster?.type || 'image/jpeg',
            thumbnailSize: poster?.size,
          },
          onProgress
        )
        return
      }
      case 'file': {
        const sealed = await sealForRoom(room, now, payload.blob)
        await matrixService.sendFile(
          chatId,
          { ...sealed, txnId, name, mimetype: mimetype || 'application/octet-stream' },
          onProgress
        )
      }
    }
  }

  /**
   * Отправка с уборкой: ушло — оптимистичное сообщение и ссылки на вложение
   * уходят (настоящее придёт из Matrix); не ушло — сообщение остаётся с
   * «Повторить», а вложение — в outbox, в том числе на устройстве.
   */
  const run = async (chatId: string, id: string, payload: MediaPayload): Promise<void> => {
    try {
      await deliver(chatId, id, payload)
      const sent = find(chatId, id)
      removeOptimistic(messages, chatId, id)
      if (sent) releaseMediaUrls(sent)
      void outbox.forget(id)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки вложения:', e)
      const failed = markSendingFailed(messages, chatId, id)
      if (failed) void outbox.keep(failed)
    }
  }

  /** Оптимистичное сообщение — сразу, до подготовки комнаты (участники грузятся по сети). */
  const start = (chatId: string, payload: MediaPayload, message: Omit<Message, 'id'>) => {
    const id = makeTempId()
    outbox.hold(id, payload)
    pushOptimistic(messages, chatId, { ...message, id })
    return run(chatId, id, payload)
  }

  const draft = (
    chatId: string,
    type: NonNullable<Message['type']>,
    url: string | undefined,
    info: Message['info']
  ): Omit<Message, 'id'> => ({
    chatId,
    senderId: currentUser.value.id,
    senderName: currentUser.value.name,
    text: '',
    type,
    url,
    info: { ...info, uploadProgress: 0 },
    rawContent: null,
    timestamp: Date.now(),
    read: true,
    status: 'sending',
  })

  // Голосовое: Blob — в local-media, плеер берёт его оттуда и рисует волну,
  // пока голосовое грузится (fetch ссылки `blob:` CSP не пускает).
  const sendAudio = async (
    chatId: string,
    blob: Blob,
    meta?: { duration?: number; name?: string }
  ) => {
    const payload: MediaPayload = {
      kind: 'audio',
      blob,
      name: meta?.name || 'voice-message',
      duration: meta?.duration || 0,
    }
    await start(
      chatId,
      payload,
      draft(chatId, 'audio', mediaUrl(payload), {
        mimetype: blob.type || 'audio/webm',
        size: blob.size,
        // Как в событии Matrix — в миллисекундах.
        duration: meta?.duration ? Math.round(meta.duration * 1000) : 0,
      })
    )
  }

  const sendImage = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    if (file.size > IMAGE_SIZE_LIMIT_BYTES) {
      console.error('[ChatStore] Image too large:', file.size, 'limit:', IMAGE_SIZE_LIMIT_BYTES)
      return
    }
    const name = (file instanceof File ? file.name : undefined) || meta?.name || 'image'
    // Без EXIF: зашифрованное фото собеседник всё равно откроет вместе с местом
    // съёмки. И не больше 2048 px: снимок с телефона каждый скачивал целиком.
    const photo = await prepareChatPhoto(file)
    const dims = await extractImageDimensions(photo)
    const payload: MediaPayload = { kind: 'image', blob: photo, name }
    await start(
      chatId,
      payload,
      draft(chatId, 'image', mediaUrl(payload), {
        mimetype: photo.type || 'image/jpeg',
        size: photo.size,
        w: dims?.w,
        h: dims?.h,
      })
    )
  }

  const sendVideo = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    const name = (file instanceof File ? file.name : undefined) || meta?.name || 'video'
    const { duration, w, h, posterBlob } = await extractVideoMetadata(file)
    const payload: MediaPayload = { kind: 'video', blob: file, name, duration, poster: posterBlob }
    await start(
      chatId,
      payload,
      draft(chatId, 'video', mediaUrl(payload), {
        mimetype: file.type || 'video/mp4',
        size: file.size,
        duration: duration ? Math.round(duration * 1000) : undefined,
        w: w || undefined,
        h: h || undefined,
        posterUrl: posterBlob ? URL.createObjectURL(posterBlob) : null,
      })
    )
  }

  const sendFile = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    if (file.size > FILE_SIZE_LIMIT_BYTES) {
      console.error('[ChatStore] File too large:', file.size, 'limit:', FILE_SIZE_LIMIT_BYTES)
      return
    }
    const name = (file instanceof File ? file.name : undefined) || meta?.name || 'file'
    // Картинка файлом — оригинал без уменьшения, но тоже без места съёмки.
    // Тип пустой — файл из облака на Android: картинку узнаём по байтам.
    const blob =
      !file.type || file.type.startsWith('image/') ? await stripPhotoMetadata(file) : file
    const payload: MediaPayload = { kind: 'file', blob, name }
    await start(
      chatId,
      payload,
      draft(chatId, 'file', undefined, {
        mimetype: blob.type || 'application/octet-stream',
        size: blob.size,
        name,
      })
    )
  }

  /**
   * Повтор неотправленного вложения — того же сообщения, с тем же файлом.
   * false — повторять нечего: вложения нет (не текст и не из этого запуска).
   */
  const retryMedia = async (chatId: string, id: string): Promise<boolean> => {
    const message = find(chatId, id)
    const payload = outbox.payload(id)
    if (!message || message.status !== 'failed' || !payload) return false
    message.status = 'sending'
    message.info = { ...message.info, uploadProgress: 0 }
    await run(chatId, id, payload)
    return true
  }

  return { sendAudio, sendImage, sendVideo, sendFile, retryMedia }
}

export type MediaSending = ReturnType<typeof useMediaSending>
