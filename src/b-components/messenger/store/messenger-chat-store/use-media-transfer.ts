// Скачивание и расшифровка входящих медиа (аудио/изображения/видео/файлы):
// разворачивает per-message ключ через pcrypto и отдаёт blob URL для рендера.

import { matrixService } from '../../services/matrix-service'
import { decryptAudioBlob } from '../../services/encryption-service'
import { decryptBytesWithSecret, sniffMimeFromBytes } from '../../services/media-decrypt'
import type { Message } from '../../types'
import type { ChatCrypto } from './use-chat-crypto'

export function useMediaTransfer(chatCrypto: ChatCrypto) {
  const { pcryptoService, getOrderedMemberIds, collectPcryptoUsers } = chatCrypto

  /** Кэш расшифрованных blob-URL по eventId — чтобы не дешифровать одно и то же повторно. */
  const decryptedMediaUrls = new Map<string, string>()

  const decryptAudioData = async (blob: Blob, message: Message): Promise<Blob | null> => {
    if (!pcryptoService.value || !message.info?.secrets) return null

    try {
      const room = matrixService.getRoom(message.chatId)
      if (!room) return null

      const memberIds = getOrderedMemberIds(room, message.timestamp)
      const users = await collectPcryptoUsers(memberIds)

      const fakeEvent = {
        sender: message.senderId,
        content: { info: { secrets: message.info.secrets } },
      }
      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) return null

      return await decryptAudioBlob(blob, decryptedSecretsStr.trim())
    } catch (e) {
      console.error('[ChatStore] Ошибка дешифрования аудио:', e)
      return null
    }
  }

  const decryptMediaBlob = async (
    blob: Blob,
    message: Message,
    fallbackMime: string
  ): Promise<Blob | null> => {
    if (!message.info?.secrets) {
      return new Blob([await blob.arrayBuffer()], { type: blob.type || fallbackMime })
    }
    if (!pcryptoService.value) return null

    try {
      const room = matrixService.getRoom(message.chatId)
      if (!room) return null

      const memberIds = getOrderedMemberIds(room, message.timestamp)
      const users = await collectPcryptoUsers(memberIds)

      const fakeEvent = {
        sender: message.senderId,
        content: { info: { secrets: message.info.secrets } },
      }
      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) {
        console.error('[ChatStore] decryptMediaBlob: decryptEvent returned null')
        return null
      }

      const arrayBuffer = await blob.arrayBuffer()
      const decryptedBytes = await decryptBytesWithSecret(arrayBuffer, decryptedSecretsStr.trim())
      const mime = sniffMimeFromBytes(decryptedBytes) || fallbackMime
      return new Blob([decryptedBytes as unknown as BlobPart], { type: mime })
    } catch (e) {
      console.error('[ChatStore] decryptMediaBlob failed:', e)
      return null
    }
  }

  /**
   * Скачивает и расшифровывает (если нужно) медиа по mxc/http url из message.url.
   * Возвращает blob URL (object URL), пригодный для <img src>/<video src>/download.
   * Кэширует результат в локальной Map по message.id.
   */
  const fetchAndDecryptMedia = async (
    message: Message,
    fallbackMime = 'application/octet-stream'
  ): Promise<string | null> => {
    if (!message.url) return null
    const cached = decryptedMediaUrls.get(message.id)
    if (cached) return cached

    try {
      const httpUrl = message.info?.httpUrl || message.url
      const response = await (
        await import('@/helpers/api/request')
      ).matrixFetch(httpUrl, { mode: 'cors' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const raw = await response.blob()

      const decrypted = await decryptMediaBlob(raw, message, fallbackMime)
      if (!decrypted) return null
      const url = URL.createObjectURL(decrypted)
      decryptedMediaUrls.set(message.id, url)
      return url
    } catch (e) {
      console.error('[ChatStore] fetchAndDecryptMedia failed:', e)
      return null
    }
  }

  return { decryptAudioData, decryptMediaBlob, fetchAndDecryptMedia }
}

export type MediaTransfer = ReturnType<typeof useMediaTransfer>
