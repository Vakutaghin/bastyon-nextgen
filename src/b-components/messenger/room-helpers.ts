/**
 * Helpers для маппинга Matrix room → Bastyon-address и поиска DM-комнат.
 *
 * Вынесены из messenger-store.ts, чтобы:
 * - переиспользовать `findExistingRoomByAddress` из chat actions HostContext'а;
 * - тестировать без зависимости от Pinia.
 */

import { matrixService } from './services/matrix-service'
import { resolveMatrixHost } from './helpers'

/**
 * Находит «партнёра» в DM-комнате: первого участника, отличного от текущего пользователя.
 * Если по join'ам не нашли — пробует currentState.getMembers (включая invited).
 * Fallback: возвращает roomId, чтобы вызывающий мог отличить «нет партнёра» от ошибки.
 */
export const getPartnerMatrixId = (room: any): string | null => {
  if (!room) return null
  const myUserId = matrixService.getClient()?.getUserId()
  let otherMember = room.getJoinedMembers?.().find((m: any) => m.userId !== myUserId)
  if (!otherMember && room.currentState?.getMembers) {
    const allMembers = room.currentState.getMembers()
    otherMember = allMembers.find(
      (m: any) => m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite')
    )
  }
  return otherMember ? otherMember.userId : room.roomId || null
}

/**
 * Ищет существующую DM-комнату с указанным Bastyon-адресом.
 * Возвращает roomId или null, если такой комнаты нет.
 */
export const findExistingRoomByAddress = (address: string): string | null => {
  const hex = matrixService.addressToHex(address).toLowerCase()
  const host = resolveMatrixHost()
  const partnerId = `@${hex}:${host}`
  const rooms = matrixService.getRooms()
  for (const room of rooms) {
    if (getPartnerMatrixId(room) === partnerId) return room.roomId
  }
  return null
}
