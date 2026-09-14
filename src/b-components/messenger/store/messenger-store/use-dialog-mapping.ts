// Маппинг matrix-комнаты в Dialog для списка диалогов: имя/аватар/verified
// собеседника (комната → участник → кэш профилей → matrix-профиль), последнее
// сообщение из таймлайна и счётчик непрочитанных. Вынесено из messenger-store,
// чтобы логику можно было гонять на фейковой комнате без pinia/Matrix.

import { t } from '@/i18n'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { isUserVerified } from '@/helpers/profile/is-user-verified'

import { matrixService } from '../../services/matrix-service'
import type { Dialog, Message } from '../../types'
import {
  getAddressFromMatrixId,
  getEventTs,
  getRoomTimelineEvents,
  isMessageEvent,
} from '../../helpers'
import { PCRYPTO_DIALOG_TIMEOUT } from '../consts'
import type { MessengerStoreContext } from './types'

/**
 * Участник комнаты в «старом» (loose) виде, как его отдаёт matrix-сервер в раннере:
 * 4-аргументный `getAvatarUrl` и прямое поле `avatarUrl` — то, чего нет в строгом
 * `RoomMember` из текущего matrix-js-sdk.
 */
interface DialogMember {
  userId: string
  name?: string
  membership?: string
  avatarUrl?: string | null
  getAvatarUrl?: (baseUrl: string, w: number, h: number, method: string) => string | undefined
}

export function useDialogMapping(ctx: MessengerStoreContext) {
  const { uiStore, chatStore, profileCache } = ctx

  // room остаётся `any`: объект приходит из matrix-сервера через legacy-API (4-арг
  // `getAvatarUrl`, поле `avatarUrl` у участника, строковый аргумент
  // `getUnreadNotificationCount('ns.total')`), который не моделируется строгим
  // `Room` из matrix-js-sdk; строгий тип дал бы каскад ошибок арности/перечислений.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy loose Matrix Room API, не покрытый типами matrix-js-sdk
  const mapRoomToDialog = async (room: any): Promise<Dialog> => {
    if (room?.loadMembersIfNeeded) {
      try {
        await room.loadMembersIfNeeded()
      } catch {
        /* ignore */
      }
    }

    const timelineEvents = getRoomTimelineEvents(room)
    const myUserId = matrixService.getClient()?.getUserId()
    const joinedMembers = room.getJoinedMembers()
    // Прямой чат определяем по сумме joined + invited (== 2), а не только по
    // joined. У свежесозданного DM собеседник ещё лишь приглашён (особенно если
    // он ни разу не заходил в мессенджер и matrix-аккаунта у него по сути нет),
    // поэтому joined == 1 и чат ошибочно выглядел как группа.
    const memberCount =
      typeof room.getInvitedAndJoinedMemberCount === 'function'
        ? room.getInvitedAndJoinedMemberCount()
        : joinedMembers.length
    const isDirect = memberCount === 2

    let otherMember = joinedMembers.find((m: DialogMember) => m.userId !== myUserId)
    if (!otherMember) {
      otherMember = room.currentState
        .getMembers()
        .find(
          (m: DialogMember) =>
            m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite')
        )
    }

    const roomName = room.name || (otherMember ? otherMember.name : t('appMsg.messenger.chat'))
    const partnerId = isDirect ? (otherMember ? otherMember.userId : room.roomId) : null
    const member = partnerId && room.getMember ? room.getMember(partnerId) : null

    // Резолв аватара: комната → участник → Matrix профиль
    let avatarUrl: string | undefined = undefined
    if (!isDirect && room.getAvatarUrl) {
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    }
    if (!avatarUrl && member?.getAvatarUrl)
      avatarUrl = member.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && member?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(member.avatarUrl, 40)
    if (!avatarUrl && isDirect && room.getAvatarUrl)
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.getAvatarUrl)
      avatarUrl = otherMember.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(otherMember.avatarUrl, 40)

    let name = roomName
    if (isDirect && member?.name) name = member.name
    let avatar = avatarUrl
    let verified = false

    // Резолв из кэша профилей
    if (partnerId) {
      const address = getAddressFromMatrixId(partnerId)
      if (address) {
        if (!profileCache.userProfiles[address]) profileCache.fetchProfiles([address])
        const p = profileCache.userProfiles[address]
        if (p?.name) {
          name = p.name
        } else {
          // Логин ещё не подгрузился (свежий аккаунт / лаг распространения имени
          // по нодам), а у matrix-юзера нет displayname — поэтому name сейчас
          // равен hex-локалпарту matrix-id. Показываем читаемый Bastyon-адрес
          // вместо сырого hex; как только профиль резолвится, profile-watcher
          // перезагрузит диалоги и подставит логин.
          const localpart = partnerId.slice(1).split(':')[0]
          if (name === localpart) name = address
        }
        const imgCandidate = p?.i || p?.avatar || p?.image
        const img = typeof imgCandidate === 'string' ? imgCandidate : undefined
        if (img) {
          const url = resolveImageUrl(img)
          if (url) avatar = url
        }
        verified = isUserVerified(p)
      }
    }

    if (!avatar && partnerId) {
      const client = matrixService.getClient()
      if (client?.getProfileInfo) {
        try {
          const profile = await client.getProfileInfo(partnerId)
          const matrixAvatar = chatStore.getMatrixAvatarUrl(profile?.avatar_url, 40)
          if (matrixAvatar) avatar = matrixAvatar
          if (profile?.displayname && !name) name = profile.displayname
        } catch {
          /* ignore */
        }
      }
    }

    chatStore.ensurePcryptoInitialized()
    if (!chatStore.pcryptoService && uiStore.isInitInProgress)
      await chatStore.waitForPcrypto(PCRYPTO_DIALOG_TIMEOUT)

    let lastMessage: Message | undefined = undefined
    for (let i = timelineEvents.length - 1; i >= 0; i--) {
      if (!isMessageEvent(timelineEvents[i])) continue
      const mapped = await chatStore.mapEventToMessage(timelineEvents[i], false)
      if (mapped) {
        lastMessage = mapped
        break
      }
    }

    const createdAt = timelineEvents.length
      ? Math.min(...timelineEvents.map(getEventTs))
      : undefined

    const unreadCount =
      uiStore.activeChatId === room.roomId
        ? 0
        : room.getUnreadNotificationCount('total') ||
          room.getUnreadNotificationCount('ns.total') ||
          0

    return {
      id: room.roomId,
      partner: { id: partnerId || room.roomId, name, avatar, verified },
      unreadCount,
      lastMessage,
      createdAt,
    }
  }

  return { mapRoomToDialog }
}

export type DialogMapping = ReturnType<typeof useDialogMapping>
