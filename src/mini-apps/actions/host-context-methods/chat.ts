/**
 * HostContext methods: Matrix-чат (открытие комнаты, создание DM, отправка
 * сообщения). Все методы лениво подгружают messenger-модули — большая часть
 * миниапп ими не пользуется, не тянем сразу.
 */

import type { Router } from 'vue-router'
import type { HostContext } from '../host-context'

export interface ChatDeps {
  router: Router
}

export type ChatMethods = Pick<
  HostContext,
  'chatOpenRoom' | 'chatGetOrCreateRoom' | 'chatSendMessage'
>

export function createChatMethods(deps: ChatDeps): ChatMethods {
  const { router } = deps

  return {
    chatOpenRoom: async (roomid) => {
      void router.push({ path: '/messages', query: { room: roomid } })
    },

    chatGetOrCreateRoom: async (users, _parameters) => {
      if (!Array.isArray(users) || users.length === 0) {
        throw new Error('chat_no_users')
      }
      if (users.length > 1) {
        // Групповые комнаты пока не поддерживаем — matrix-service умеет только
        // createDirectRoom(inviteeId). Когда понадобится — добавить
        // createGroupRoom() в matrix-service.
        throw new Error('chat_group_rooms_not_supported')
      }

      const address = users[0]
      if (!address) throw new Error('chat_no_users')

      const { matrixService } = await import('@/b-components/messenger/services/matrix-service')
      const { resolveMatrixHost } = await import('@/b-components/messenger/helpers')
      const { useMessengerStore } = await import('@/b-components/messenger/store/messenger-store')

      // initMatrix идемпотентен (см. messenger-store.ts) — если клиент уже
      // залогинен, вернётся быстро; иначе — login + sync.
      await useMessengerStore().initMatrix()

      const hex = matrixService.addressToHex(address).toLowerCase()
      const partnerId = `@${hex}:${resolveMatrixHost()}`

      // Сначала ищем существующую DM-комнату с этим партнёром, чтобы не плодить
      // дубли. Логика повторяет findExistingRoomByAddress из messenger-store,
      // но без зависимости от UI-стора.
      const existing = matrixService
        .getRooms()
        .find((room: { roomId: string; getMember?: (id: string) => unknown }) => {
          const member = room.getMember?.(partnerId)
          return Boolean(member)
        })
      if (existing) return { roomid: existing.roomId }

      const roomId = await matrixService.createDirectRoom(partnerId)
      if (!roomId) throw new Error('chat_create_room_failed')
      return { roomid: roomId }
    },

    chatSendMessage: async (roomid, content) => {
      if (!roomid || typeof roomid !== 'string') throw new Error('chat_no_roomid')

      const text =
        typeof content === 'string'
          ? content
          : content && typeof content === 'object' && 'body' in content
            ? String((content as { body: unknown }).body)
            : ''
      if (!text) throw new Error('chat_empty_content')

      const { useMessengerStore } = await import('@/b-components/messenger/store/messenger-store')
      const { useMessengerChatStore } =
        await import('@/b-components/messenger/store/messenger-chat-store')

      await useMessengerStore().initMatrix()
      // P0-2: НЕ шлём сырой m.text. sendTextContent шифрует DM (per-user pcrypto)
      // и группы (общий ключ) точно так же, как UI-путь; открытый текст в личку
      // (оседающий на homeserver'е) исключён.
      const res = await useMessengerChatStore().sendTextContent(roomid, text)
      return (res as Record<string, unknown>) ?? { ok: true }
    },
  }
}
