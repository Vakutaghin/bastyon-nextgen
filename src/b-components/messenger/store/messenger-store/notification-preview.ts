/**
 * Текст и отправитель для системного уведомления о новом сообщении (S41).
 *
 * Раньше в уведомление уходил `content.body` как есть — а у нас он почти
 * всегда шифротекст (base64-JSON ключей или hex общего ключа), и имя
 * отправителя бралось из matrix-id, то есть hex-локалпарт вида
 * `@3f2a…:matrix.pocketnet.app`. Показывать это пользователю бессмысленно:
 * расшифровать сообщение в момент уведомления мы не можем (ключи достаются
 * асинхронно), поэтому честно пишем тип содержимого.
 */

import { t } from '@/i18n'

interface EventLike {
  getContent?: () => Record<string, unknown> | undefined
  getType?: () => string | undefined
  type?: string
  content?: Record<string, unknown>
}

/** Похоже ли тело на шифротекст (base64/hex без пробелов приличной длины). */
export function looksEncrypted(body: unknown): boolean {
  if (typeof body !== 'string' || body.length < 32) return false
  if (/\s/.test(body)) return false
  return /^[A-Za-z0-9+/=]+$/.test(body) || /^[0-9a-fA-F]+$/.test(body)
}

/** Короткое описание сообщения для уведомления. */
export function notificationPreviewFor(event: EventLike): string {
  const content = (event.getContent?.() ?? event.content ?? {}) as Record<string, unknown>
  const type = event.getType?.() ?? event.type ?? ''
  const msgtype = typeof content.msgtype === 'string' ? content.msgtype : ''

  if (msgtype === 'm.image') return t('messenger.notifyImage')
  if (msgtype === 'm.video') return t('messenger.notifyVideo')
  if (msgtype === 'm.audio') return t('messenger.notifyAudio')
  if (msgtype === 'm.file') return t('messenger.notifyFile')

  const body = content.body
  if (type === 'm.room.encrypted' || msgtype === 'm.encrypted' || looksEncrypted(body)) {
    return t('messenger.notifyEncrypted')
  }
  return typeof body === 'string' && body ? body : t('messenger.notifyEncrypted')
}

/** Имя отправителя: профиль Bastyon → имя участника комнаты → адрес. */
export function senderDisplayName(opts: {
  profileName?: string
  roomMemberName?: string
  address?: string | null
  matrixId?: string
}): string {
  if (opts.profileName) return opts.profileName
  // Имя участника комнаты в Matrix для наших юзеров — тот же hex, толку нет.
  if (opts.roomMemberName && !/^@?[0-9a-f]{16,}/i.test(opts.roomMemberName)) {
    return opts.roomMemberName
  }
  if (opts.address) return opts.address
  return opts.matrixId ?? ''
}
