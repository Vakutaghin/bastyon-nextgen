// Отправка медиа-вложений (аудио/изображения/видео/файлы): оптимистичное
// сообщение → шифрование per-message ключом → загрузка через matrixService.
// В публичную группу и группу от 50 участников вложение уходит открыто, как
// у прежнего клиента и как текст (encryption-rule). Текстовые сообщения и
// реакции — в use-message-sending.

import { matrixService } from '../../services/matrix-service'
import { registerLocalMedia, releaseLocalMedia } from '../../services/local-media'
import { encryptAudioBlob } from '../../services/encryption-service'
import { encryptBlobWithRandomKey, wrapKeyForRoom } from '../../services/media-encrypt'
import { extractImageDimensions, extractVideoMetadata } from '../../services/media-metadata'
import { isTetatetchat } from '../../helpers'
import { DEFAULT_ENCRYPTION_BLOCK } from '../consts'
import type { Message } from '../../types'
import type { ChatContext } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import { roomEncrypts } from './encryption-rule'
import {
  createProgressHandler,
  makeTempId,
  markLastSendingFailed,
  pushOptimistic,
  removeOptimistic,
  revokeObjectUrlQuiet,
} from './media-sending-helpers'

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

export function useMediaSending(ctx: ChatContext, chatCrypto: ChatCrypto) {
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

  const sendAudio = async (
    chatId: string,
    blob: Blob,
    meta?: { duration?: number; name?: string }
  ) => {
    try {
      // Оптимистичное сообщение — сразу, до подготовки комнаты: подгрузка
      // участников идёт по сети, и голосовое появлялось в чате с задержкой
      // после того, как кнопку отпустили. Blob — в local-media: плеер берёт
      // его оттуда и рисует волну, пока голосовое грузится (fetch ссылки
      // `blob:` CSP не пускает, и вместо волны была ошибка загрузки).
      const objectUrl = registerLocalMedia(blob)
      const tempId = makeTempId()
      const now = Date.now()
      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'audio',
        url: objectUrl,
        info: {
          mimetype: blob.type || 'audio/webm',
          size: blob.size,
          // Как в событии Matrix — в миллисекундах.
          duration: meta?.duration ? Math.round(meta.duration * 1000) : 0,
          uploadProgress: 0,
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
      }
      pushOptimistic(messages, chatId, tempMessage)

      const room = await prepareRoom(chatId)
      const onProgress = createProgressHandler(messages, chatId, tempId)

      const memberIds = getOrderedMemberIds(room, now)
      const audio = {
        name: meta?.name || 'voice-message',
        mimetype: blob.type || 'audio/webm',
        duration: meta?.duration || 0,
      }

      if (roomEncrypts(room, memberIds)) {
        const users = await collectPcryptoUsers(memberIds)
        const block = isTetatetchat(room)
          ? DEFAULT_ENCRYPTION_BLOCK
          : (await getCurrentBlockHeight()) || DEFAULT_ENCRYPTION_BLOCK

        const { encryptedBlob, secretStr } = await encryptAudioBlob(blob)
        const version = 2
        const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)

        await matrixService.sendAudio(
          chatId,
          { ...audio, blob: encryptedBlob, size: encryptedBlob.size, secrets, block },
          onProgress
        )
      } else {
        await matrixService.sendAudio(chatId, { ...audio, blob, size: blob.size }, onProgress)
      }

      // Удаляем оптимистичное сообщение
      removeOptimistic(messages, chatId, tempId)
      releaseLocalMedia(objectUrl)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки аудио:', e)
      markLastSendingFailed(messages, chatId, 'audio')
    }
  }

  const sendImage = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      if (file.size > IMAGE_SIZE_LIMIT_BYTES) {
        console.error('[ChatStore] Image too large:', file.size, 'limit:', IMAGE_SIZE_LIMIT_BYTES)
        return
      }
      const room = await prepareRoom(chatId)

      const mimetype = file.type || 'image/jpeg'
      const fileName = (file instanceof File ? file.name : undefined) || meta?.name || 'image'
      const dims = await extractImageDimensions(file)
      const objectUrl = URL.createObjectURL(file)
      const tempId = makeTempId()
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'image',
        url: objectUrl,
        info: { mimetype, size: file.size, w: dims?.w, h: dims?.h, uploadProgress: 0 },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
      }

      pushOptimistic(messages, chatId, tempMessage)

      const onProgress = createProgressHandler(messages, chatId, tempId)

      const sealed = await sealForRoom(room, now, file)

      await matrixService.sendImage(
        chatId,
        { ...sealed, name: fileName, mimetype, width: dims?.w, height: dims?.h },
        onProgress
      )

      removeOptimistic(messages, chatId, tempId)
      revokeObjectUrlQuiet(objectUrl)
    } catch (e) {
      console.error('[ChatStore] Failed to send image:', e)
      markLastSendingFailed(messages, chatId, 'image')
    }
  }

  const sendVideo = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      const room = await prepareRoom(chatId)

      const mimetype = file.type || 'video/mp4'
      const fileName = (file instanceof File ? file.name : undefined) || meta?.name || 'video'
      const { duration, w, h, posterBlob } = await extractVideoMetadata(file)
      const objectUrl = URL.createObjectURL(file)
      const posterLocalUrl = posterBlob ? URL.createObjectURL(posterBlob) : null
      const tempId = makeTempId()
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'video',
        url: objectUrl,
        info: {
          mimetype,
          size: file.size,
          duration: duration ? Math.round(duration * 1000) : undefined,
          w: w || undefined,
          h: h || undefined,
          posterUrl: posterLocalUrl,
          uploadProgress: 0,
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
      }

      pushOptimistic(messages, chatId, tempMessage)

      const onProgress = createProgressHandler(messages, chatId, tempId)

      const [posterMxcUrl, sealed] = await Promise.all([
        posterBlob
          ? matrixService
              .uploadContent(posterBlob, { name: 'poster.jpg', type: 'image/jpeg' })
              .catch(() => null)
          : Promise.resolve(null),
        sealForRoom(room, now, file),
      ])

      await matrixService.sendVideo(
        chatId,
        {
          ...sealed,
          name: fileName,
          mimetype,
          duration,
          width: w || undefined,
          height: h || undefined,
          thumbnailUrl: posterMxcUrl || undefined,
          thumbnailMimetype: posterBlob?.type || 'image/jpeg',
          thumbnailSize: posterBlob?.size,
        },
        onProgress
      )

      removeOptimistic(messages, chatId, tempId)
      revokeObjectUrlQuiet(objectUrl)
      revokeObjectUrlQuiet(posterLocalUrl)
    } catch (e) {
      console.error('[ChatStore] Failed to send video:', e)
      markLastSendingFailed(messages, chatId, 'video')
    }
  }

  const sendFile = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      if (file.size > FILE_SIZE_LIMIT_BYTES) {
        console.error('[ChatStore] File too large:', file.size, 'limit:', FILE_SIZE_LIMIT_BYTES)
        return
      }
      const room = await prepareRoom(chatId)

      const mimetype = file.type || 'application/octet-stream'
      const fileName = (file instanceof File ? file.name : undefined) || meta?.name || 'file'
      const tempId = makeTempId()
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'file',
        url: undefined,
        info: { mimetype, size: file.size, name: fileName, uploadProgress: 0 },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
      }

      pushOptimistic(messages, chatId, tempMessage)

      const onProgress = createProgressHandler(messages, chatId, tempId)

      const sealed = await sealForRoom(room, now, file)

      await matrixService.sendFile(chatId, { ...sealed, name: fileName, mimetype }, onProgress)

      removeOptimistic(messages, chatId, tempId)
    } catch (e) {
      console.error('[ChatStore] Failed to send file:', e)
      markLastSendingFailed(messages, chatId, 'file')
    }
  }

  return { sendAudio, sendImage, sendVideo, sendFile }
}

export type MediaSending = ReturnType<typeof useMediaSending>
