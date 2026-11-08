// Шифровать ли сообщение в комнату: одно правило для текста и вложений.

import { isTetatetchat } from '../../helpers'
import { GROUP_ENCRYPTION_MEMBER_LIMIT } from '../consts'
import type { MxRoom } from './types'

/**
 * Шифровать ли группу — правило прежнего клиента (bastyon-chat,
 * `pcrypto.canBeEncrypt`): публичную группу и группу от 50 участников он не
 * шифрует, сообщения и вложения в них идут открыто, и все клиенты так их и
 * читают. Раньше NextGen шифровал любую группу общим ключом на всех участников:
 * в чатах на сотни человек это не работало, а один участник без ключей запирал
 * группу для всех.
 *
 * Комнату, где участник один я, прежний клиент тоже не шифрует, а здесь она
 * шифруется: так выглядит и личный чат, куда собеседник ещё не пришёл или
 * откуда вышел (`isTetatetchat` узнаёт личный чат по двум участникам), и
 * открытый текст ушёл бы туда, где его ждут зашифрованным.
 */
export function groupCanBeEncrypted(room: MxRoom, memberCount: number): boolean {
  return groupPlaintextReason(room, memberCount) === null
}

/**
 * Почему группа идёт без шифрования: открытая или слишком большая; null —
 * шифруется. По этому же правилу шапка чата и окно группы предупреждают, что
 * переписка открыта.
 */
export function groupPlaintextReason(room: MxRoom, memberCount: number): GroupPlaintextReason {
  if (room.getJoinRule?.() === 'public') return 'public'
  return memberCount < GROUP_ENCRYPTION_MEMBER_LIMIT ? null : 'large'
}

export type GroupPlaintextReason = 'public' | 'large' | null

/** Личный чат шифруется всегда, группа — по правилу выше. */
export function roomEncrypts(room: MxRoom, memberIds: readonly string[]): boolean {
  return isTetatetchat(room) || groupCanBeEncrypted(room, memberIds.length)
}
