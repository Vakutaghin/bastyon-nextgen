// Отправка медиа-вложений (аудио/изображения/видео/файлы): оптимистичное
// сообщение → шифрование per-message ключом → загрузка через matrixService.
// Текстовые сообщения и реакции — в use-message-sending.

import { matrixService } from '../../services/matrix-service'
import { encryptAudioBlob } from '../../services/encryption-service'
import { encryptBlobWithRandomKey, wrapKeyForRoom } from '../../services/media-encrypt'
import { extractImageDimensions, extractVideoMetadata } from '../../services/media-metadata'
import { isTetatetchat } from '../../helpers'
import { DEFAULT_ENCRYPTION_BLOCK } from '../consts'
import type { Message } from '../../types'
import type { ChatContext } from './types'
import type { ChatCrypto } from './use-chat-crypto'
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
const IMAGE_SIZE_LIMIT_BYTES = 100 * 1024 * 1024
const FILE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024

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

  const sendAudio = async (
    chatId: string,
    blob: Blob,
    meta?: { duration?: number; name?: string }
  ) => {
    try {
      const room = await prepareRoom(chatId)

      // Оптимистичное сообщение
      const objectUrl = URL.createObjectURL(blob)
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
          duration: meta?.duration || 0,
          uploadProgress: 0,
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
      }
      pushOptimistic(messages, chatId, tempMessage)

      const onProgress = createProgressHandler(messages, chatId, tempId)

      // Шифрование
      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)

      const isDirect = isTetatetchat(room)
      const block = isDirect
        ? DEFAULT_ENCRYPTION_BLOCK
        : (await getCurrentBlockHeight()) || DEFAULT_ENCRYPTION_BLOCK

      const { encryptedBlob, secretStr } = await encryptAudioBlob(blob)
      const version = 2
      const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)

      await matrixService.sendAudio(
        chatId,
        {
          blob: encryptedBlob,
          name: meta?.name || 'voice-message',
          mimetype: blob.type || 'audio/webm',
          duration: meta?.duration || 0,
          size: encryptedBlob.size,
          secrets,
          block,
        },
        onProgress
      )

      // Удаляем оптимистичное сообщение
      removeOptimistic(messages, chatId, tempId)
      revokeObjectUrlQuiet(objectUrl)
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(file)
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendImage(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          width: dims?.w,
          height: dims?.h,
          size: encryptedBlob.size,
          secrets,
          block,
        },
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const [posterMxcUrl, encryptedVideo] = await Promise.all([
        posterBlob
          ? matrixService
              .uploadContent(posterBlob, { name: 'poster.jpg', type: 'image/jpeg' })
              .catch(() => null)
          : Promise.resolve(null),
        encryptBlobWithRandomKey(file),
      ])

      const { encryptedBlob, secretStr } = encryptedVideo
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendVideo(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          duration,
          width: w || undefined,
          height: h || undefined,
          size: encryptedBlob.size,
          thumbnailUrl: posterMxcUrl || undefined,
          thumbnailMimetype: posterBlob?.type || 'image/jpeg',
          thumbnailSize: posterBlob?.size,
          secrets,
          block,
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(file)
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendFile(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          size: encryptedBlob.size,
          secrets,
          block,
        },
        onProgress
      )

      removeOptimistic(messages, chatId, tempId)
    } catch (e) {
      console.error('[ChatStore] Failed to send file:', e)
      markLastSendingFailed(messages, chatId, 'file')
    }
  }

  return { sendAudio, sendImage, sendVideo, sendFile }
}

export type MediaSending = ReturnType<typeof useMediaSending>
