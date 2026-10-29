// Маппинг matrix-комнаты в Dialog для списка диалогов: имя/аватар/verified
// собеседника (комната → участник → кэш профилей → matrix-профиль), последнее
// сообщение из таймлайна и счётчик непрочитанных. Вынесено из messenger-store,
// чтобы логику можно было гонять на фейковой комнате без pinia/Matrix.

import { t } from '@/i18n'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { isUserVerified } from '@/helpers/profile/is-user-verified'
import { userMark, type UserMark } from '@/helpers/profile/user-mark'

import { matrixService } from '../../services/matrix-service'
import type { Dialog, DialogGroup, Message } from '../../types'
import {
  chatUserName,
  getAddressFromMatrixId,
  getEventTs,
  getRoomTimelineEvents,
  isMessageEvent,
  isTetatetchat,
} from '../../helpers'
import { groupMembers, membersTitle, previewMemberIds, readGroupState } from '../../lib/group-chat'
import { PCRYPTO_DIALOG_TIMEOUT } from '../consts'
import type { MessengerStoreContext } from './types'

/**
 * Участник комнаты в «старом» (loose) виде, как его отдаёт matrix-сервер в раннере:
 * 4-аргументный `getAvatarUrl` и прямое поле `avatarUrl` — то, чего нет в строгом
 * `RoomMember` из текущего matrix-js-sdk.
 */
/**
 * Имя личной комнаты Bastyon: `#` и SHA-224 от двух matrix-id (`tetatetid`).
 * Человеку оно ничего не говорит, в списке чатов его не показываем.
 */
const TETATET_ROOM_NAME = /^#[0-9a-f]{56}$/i

interface DialogMember {
  userId: string
  name?: string
  membership?: string
  avatarUrl?: string | null
  getAvatarUrl?: (baseUrl: string, w: number, h: number, method: string) => string | undefined
}

// room остаётся `any`: объект приходит из matrix-сервера через legacy-API (4-арг
// `getAvatarUrl`, поле `avatarUrl` у участника, строковый аргумент
// `getUnreadNotificationCount('ns.total')`), который не моделируется строгим
// `Room` из matrix-js-sdk; строгий тип дал бы каскад ошибок арности/перечислений.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy loose Matrix Room API, не покрытый типами matrix-js-sdk
type LooseRoom = any

export function useDialogMapping(ctx: MessengerStoreContext) {
  const { uiStore, chatStore, profileCache } = ctx

  /** Непрочитанные по счётчику сервера; у открытого чата — ноль. */
  const unreadCountOf = (room: LooseRoom): number =>
    uiStore.activeChatId === room.roomId
      ? 0
      : room.getUnreadNotificationCount('total') || room.getUnreadNotificationCount('ns.total') || 0

  /**
   * Счётчики списка — по свежим числам сервера, без пересборки списка. Число
   * меняется и без новых сообщений: переписку прочитали на другом устройстве,
   * а после смены аккаунта список сначала встаёт из кэша прошлого раза. Список
   * пересобирался только по новому сообщению, и значки на кнопке чата и в
   * шапке оставались прежними.
   */
  const refreshUnreadCounts = (): void => {
    for (const dialog of uiStore.dialogs) {
      const room = matrixService.getRoom(dialog.id)
      if (!room) continue
      const count = unreadCountOf(room)
      if (dialog.unreadCount !== count) dialog.unreadCount = count
    }
  }

  /** Собеседник личного чата: комната → участник → кэш профилей → matrix-профиль. */
  const directPartner = async (
    room: LooseRoom,
    otherMember?: DialogMember
  ): Promise<Dialog['partner']> => {
    const partnerId = otherMember ? otherMember.userId : room.roomId
    const member = room.getMember ? room.getMember(partnerId) : null

    // Резолв аватара: участник → комната → Matrix профиль
    let avatarUrl: string | undefined = undefined
    if (member?.getAvatarUrl)
      avatarUrl = member.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && member?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(member.avatarUrl, 40)
    if (!avatarUrl && room.getAvatarUrl)
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.getAvatarUrl)
      avatarUrl = otherMember.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(otherMember.avatarUrl, 40)

    let name: string = room.name || otherMember?.name || t('appMsg.messenger.chat')
    if (member?.name) name = member.name
    let avatar = avatarUrl
    let verified = false
    let mark: UserMark | null = null

    // Резолв из кэша профилей
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
        if (name === localpart || TETATET_ROOM_NAME.test(name)) name = address
      }
      const imgCandidate = p?.i || p?.avatar || p?.image
      const img = typeof imgCandidate === 'string' ? imgCandidate : undefined
      if (img) {
        const url = resolveImageUrl(img)
        if (url) avatar = url
      }
      verified = isUserVerified(p, address)
      mark = userMark(p, address)
    }

    // Собеседник ещё не известен — вместо него id комнаты, профиля у неё нет.
    if (!avatar && partnerId.startsWith('@')) {
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

    // Собеседника не нашли (участники ещё не пришли с синком) — хотя бы не хэш.
    if (TETATET_ROOM_NAME.test(name)) name = t('appMsg.messenger.chat')

    return { id: partnerId, name, avatar, verified, mark }
  }

  /**
   * Группа: название и картинка самой комнаты. Без картинки список рисует
   * мозаику из участников — аватар одного из них выдавал группу за личный чат.
   */
  const groupPartner = (
    room: LooseRoom,
    myId: string,
    summaryCount: number
  ): { partner: Dialog['partner']; group: DialogGroup } => {
    const state = readGroupState(room, (mxc) => chatStore.getMatrixAvatarUrl(mxc, 96))
    const members = groupMembers(room)
    const previewIds = previewMemberIds(members, myId)

    // Имена и аватары мозаики — из профилей Bastyon.
    const missing = previewIds
      .map((id) => getAddressFromMatrixId(id))
      .filter((a): a is string => !!a && !profileCache.userProfiles[a])
    if (missing.length) profileCache.fetchProfiles(missing)

    // Участники грузятся лениво: число из сводки комнаты точнее загруженного списка.
    const memberCount = Math.max(summaryCount || 0, members.length, 1)
    const name =
      state.name ||
      membersTitle(
        previewIds.map((id) =>
          chatUserName(id, profileCache.userProfiles, room.getMember?.(id)?.name)
        ),
        memberCount - 1
      )
    const group: DialogGroup = { memberCount, previewIds }
    if (state.isPublic) group.isPublic = true
    if (state.topic) group.topic = state.topic
    return {
      partner: { id: room.roomId, name, avatar: state.avatar, verified: false, mark: null },
      group,
    }
  }

  const mapRoomToDialog = async (room: LooseRoom): Promise<Dialog> => {
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
    // Личная комната, из которой собеседник вышел, — тоже личная: по составу
    // (вступившие + приглашённые = 1) она выглядела группой, и в списке вместо
    // ника стояло имя комнаты «#<sha224>». Признак — как у прежнего клиента.
    const isTetatet = isTetatetchat(room)
    // Группа на двоих — всё равно группа: прежний клиент называет группы с «@».
    // Личная комната, где собеседник ещё не пришёл с синком, узнаётся по имени-хэшу.
    const roomName = typeof room.name === 'string' ? room.name : ''
    const isDirect =
      isTetatet ||
      TETATET_ROOM_NAME.test(roomName) ||
      (memberCount === 2 && !roomName.startsWith('@'))

    let otherMember = joinedMembers.find((m: DialogMember) => m.userId !== myUserId)
    if (!otherMember) {
      otherMember = room.currentState
        .getMembers()
        .find(
          (m: DialogMember) =>
            m.userId !== myUserId &&
            (m.membership === 'join' ||
              m.membership === 'invite' ||
              (isTetatet && m.membership === 'leave'))
        )
    }

    let partner: Dialog['partner']
    let group: DialogGroup | undefined
    if (isDirect) {
      partner = await directPartner(room, otherMember)
    } else {
      ;({ partner, group } = groupPartner(room, myUserId || '', memberCount))
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

    // Чат создал собеседник, а нас только пригласили: до вступления (оно — при
    // открытии чата) Matrix ленту не отдаёт, и чат с новыми сообщениями стоял в
    // самом низу списка. Его время — время приглашения, как в прежнем клиенте.
    const invited = room.getMyMembership?.() === 'invite'
    const myMemberEvent = myUserId ? room.getMember?.(myUserId)?.events?.member : null
    const createdAt = timelineEvents.length
      ? Math.min(...timelineEvents.map(getEventTs))
      : getEventTs(myMemberEvent) || undefined
    // Кто пригласил — в списке «Приглашение в чат» вместо пустой строки.
    const invitedBy = invited ? myMemberEvent?.getSender?.() || partner.id : ''

    const unreadCount = unreadCountOf(room)

    const muted = matrixService.isRoomMuted(room.roomId)
    // Без звука сервер непрочитанные не считает: новое видно по отметке прочтения.
    // В приглашении сообщения есть, но сосчитать их до вступления нельзя.
    const hasUnread =
      uiStore.activeChatId !== room.roomId &&
      (invited ||
        (muted &&
          !!lastMessage &&
          !!myUserId &&
          lastMessage.senderId !== myUserId &&
          typeof room.hasUserReadEvent === 'function' &&
          !room.hasUserReadEvent(myUserId, lastMessage.id)))

    return {
      id: room.roomId,
      partner,
      unreadCount,
      lastMessage,
      createdAt,
      ...(group ? { group } : {}),
      ...(muted ? { muted } : {}),
      ...(hasUnread ? { hasUnread } : {}),
      ...(invited ? { invite: { by: invitedBy } } : {}),
    }
  }

  return { mapRoomToDialog, refreshUnreadCounts }
}

export type DialogMapping = ReturnType<typeof useDialogMapping>
