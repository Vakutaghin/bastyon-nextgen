// Подписки главного стора на события Matrix-клиента: Room.timeline (реакции,
// удаления, новые сообщения → звук/уведомление/read-marker/перезагрузка
// диалогов) и sync (состояние синка, первая загрузка диалогов на PREPARED).
// Вынесено из messenger-store: обработчики зависят только от подсторов и
// двух колбэков, поэтому проверяются на фейковом matrixService без pinia.

import { t } from '@/i18n'
import { notifyMessage } from '@/composables/use-browser-notifications'
import { logger } from '@/services/logger'
import { playSound } from '@/services/app-sounds'

import { matrixService } from '../../services/matrix-service'
import {
  getEventContent,
  getEventId,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
  getAddressFromMatrixId,
} from '../../helpers'
import { notificationPreviewFor, senderDisplayName } from './notification-preview'
import { syncErrorReason, type SyncErrorKind } from '../../lib/sync-error'
import { markDeleted } from '../../lib/chat-history'
import { archiveRedactIds } from '../../lib/archive-redact'
import { SOUND_MAX_AGE } from '../consts'
import type { MessengerStoreContext } from './types'

const log = logger.scope('[MessengerStore]')

export interface MatrixListenerCallbacks {
  /** Полная (silent) перезагрузка диалогов — на 'PREPARED'. */
  loadDialogs: (silent?: boolean) => Promise<void>
  /** Дебаунсированная перезагрузка — на каждое новое сообщение. */
  scheduleLoadDialogs: () => void
  /** Отметить чат прочитанным, если он на экране (read-marker). */
  markRoomRead: (roomId: string) => Promise<void>
  /** Счётчики непрочитанных — по свежим числам сервера, после каждого синка. */
  refreshUnreadCounts?: () => void
  /**
   * Сервер отверг токен (M_UNKNOWN_TOKEN): SDK остановил синк и сам больше не
   * пробует — нужен новый вход.
   */
  onTokenRejected?: () => void
  /** Копия переписки на устройстве (use-archive-sync, messenger-archive-store). */
  archive?: ArchiveListenerHooks
}

export interface ArchiveListenerHooks {
  /** В комнате новое: сохранить; `reactionTarget` — у него поменялись реакции. */
  noteRoom: (roomId: string, reactionTarget?: string) => void
  /** Сообщения удалены у всех — и из копии. */
  remove: (roomId: string, ids: string[]) => void
  /** Участник удалил то, что сервер уже стёр (lib/archive-redact): проверить права и стереть. */
  removeAuthored: (roomId: string, ids: string[], sender: string, at: number) => void
  /** Лента комнаты началась заново (синк с разрывом) — проверить пропуск. */
  scheduleWalk: (roomId: string) => void
  /** Все сохраняемые чаты — после входа и восстановления связи. */
  scheduleAll: () => void
  /** Синк идёт — продолжить отложенное. */
  kick: () => void
}

/** Подпись к «Ошибке синхронизации»: почему синк не идёт. */
const REASON_KEY: Record<SyncErrorKind, string | null> = {
  network: 'appMsg.messenger.syncErrorNetwork',
  timeout: 'appMsg.messenger.syncErrorTimeout',
  server: 'appMsg.messenger.syncErrorServer',
  token: 'appMsg.messenger.syncErrorToken',
  tor: 'appMsg.messenger.syncErrorTor',
  unknown: null,
}

/**
 * Регистрирует обработчики Room.timeline и sync. Вызывается один раз перед
 * `matrixService.login` (matrixService копит подписки до создания клиента).
 */
export function registerMatrixListeners(
  ctx: MessengerStoreContext,
  callbacks: MatrixListenerCallbacks
): void {
  const { uiStore, chatStore } = ctx
  const {
    loadDialogs,
    scheduleLoadDialogs,
    markRoomRead,
    onTokenRejected,
    refreshUnreadCounts,
    archive,
  } = callbacks

  matrixService.on(
    'Room.timeline',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- событие читается и как MatrixEvent (getId), и как сырой JSON (event_id), а room передаётся в приватный MxRoom-тип chat-store; единый строгий тип неприменим
    async (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return
      const evType = getEventType(event)
      if (evType === 'm.reaction') {
        const roomId = getEventRoomId(event)
        const target = getEventContent(event)['m.relates_to']?.event_id
        archive?.noteRoom(roomId, typeof target === 'string' ? target : undefined)
        if (uiStore.activeChatId === roomId) {
          const client = matrixService.getClient()
          const list = chatStore.messages[roomId]
          if (client && list)
            chatStore.enrichMessagesWithReactions(room, list, client.getUserId() || '')
        }
        return
      }

      // Ключ группы и участники: от них зависит расшифровка. Сообщение могло
      // прийти раньше своего ключа и остаться заглушкой — пробуем ещё раз,
      // и превью в списке диалогов тоже.
      if (evType === 'm.room.encryption' || evType === 'm.room.member') {
        const roomId = getEventRoomId(event)
        if (roomId) {
          chatStore.retryUndecrypted(roomId)
          scheduleLoadDialogs()
          // Что не расшифровалось и потому не сохранено — теперь может.
          archive?.noteRoom(roomId)
        }
        return
      }

      // Удалили то, что сервер уже стёр: есть только в копиях на устройствах.
      const archiveRedacts = archiveRedactIds(evType, getEventContent(event))
      if (archiveRedacts.length) {
        archive?.removeAuthored(
          getEventRoomId(event),
          archiveRedacts,
          getEventSender(event),
          getEventTs(event)
        )
        return
      }

      // Redaction (удаление сообщения) — в ленте остаётся отметка, кто удалил.
      if (evType === 'm.room.redaction') {
        const roomId = getEventRoomId(event)
        const redactedId =
          (typeof event.getAssociatedId === 'function' ? event.getAssociatedId() : undefined) ||
          event.event?.redacts ||
          event.redacts ||
          (typeof event.getContent === 'function' ? event.getContent()?.redacts : undefined)
        if (roomId && typeof redactedId === 'string') {
          markDeleted(chatStore.messages[roomId], redactedId, {
            by: getEventSender(event),
            at: getEventTs(event),
          })
          // Удалили у всех — значит, и с этого устройства.
          archive?.remove(roomId, [redactedId])
        }
        return
      }

      try {
        if (isRenderableMessageEvent(event)) {
          const roomId = getEventRoomId(event)
          if (chatStore.currentUser.id === 'me') {
            const client = matrixService.getClient()
            if (client) chatStore.currentUser.id = client.getUserId() || 'me'
          }

          const senderId = getEventSender(event)
          const isRecent = Date.now() - getEventTs(event) < SOUND_MAX_AGE
          // «Чат открыт» = виджет виден и это его комната. Свёрнутое окно с
          // выбранным чатом раньше считалось открытым: ни звука, ни бейджа, но
          // серверу уходило «прочитано» (V30).
          const onScreen = uiStore.isChatOnScreen(roomId)
          // Правка — то же сообщение, а не новое: без звука и уведомления.
          const isEdit = getEventContent(event)['m.relates_to']?.rel_type === 'm.replace'
          // «Без звука» (правило уведомлений комнаты) — ни звука, ни уведомления.
          const muted = matrixService.isRoomMuted(roomId)
          if (senderId !== chatStore.currentUser.id && !onScreen && isRecent && !isEdit && !muted) {
            playSound('message')
            // Браузерное уведомление о новом сообщении (если вкладка в фоне
            // и пользователь включил браузерные уведомления).
            try {
              // Имя — из профиля Bastyon, а не hex-локалпарт матрикса; текст —
              // человеческое описание, а не шифротекст (S41).
              let address: string | null = null
              try {
                address = getAddressFromMatrixId(senderId)
              } catch {
                address = null
              }
              const profileName = address
                ? ctx.profileCache?.userProfiles?.[address]?.name
                : undefined
              const senderName = senderDisplayName({
                profileName,
                roomMemberName: room.getMember?.(senderId)?.name,
                address,
                matrixId: senderId,
              })
              notifyMessage(senderName, notificationPreviewFor(event))
            } catch {
              /* ignore */
            }
          }

          if (uiStore.activeChatId === roomId) {
            const msg = await chatStore.mapEventToMessage(event)
            if (!msg) return
            // Пока расшифровывали, копия своего события могла дойти до сервера и
            // получить настоящий id — иначе в ленту легла бы вторая, `~`-копия.
            const currentId = getEventId(event)
            if (currentId !== msg.id && currentId.startsWith('$')) msg.id = currentId
            if (!chatStore.messages[roomId]) chatStore.messages[roomId] = []
            if (!chatStore.messages[roomId].find((m) => m.id === msg.id))
              chatStore.messages[roomId].push(msg)
            chatStore.watchUndecrypted(roomId)
            const c = matrixService.getClient()
            if (c)
              chatStore.enrichMessagesWithReactions(
                room,
                chatStore.messages[roomId],
                c.getUserId() || ''
              )

            if (onScreen) await markRoomRead(roomId)
          }

          archive?.noteRoom(roomId)
          scheduleLoadDialogs()
        }
      } catch (e) {
        log.error('Ошибка в Room.timeline:', e)
      }
    }
  )

  // Своё событие дошло до сервера: SDK сменил id его копии `~…` на настоящий `$…`.
  matrixService.on(
    'Room.localEchoUpdated',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MatrixEvent передаётся в приватный MxEvent-тип chat-store, как в Room.timeline выше
    (event: any, _room: unknown, oldEventId?: string) => {
      void chatStore.adoptLocalEcho(event, oldEventId)
      // Своё сообщение получило настоящий id — теперь его можно сохранить.
      archive?.noteRoom(getEventRoomId(event))
      // В списке у последнего сообщения «…» сменится на «✓»: новых событий
      // ленты при этом нет, сам список о подтверждении не узнал бы.
      scheduleLoadDialogs()
    }
  )

  // Новая комната — приглашение в чат или группу — приходит без событий
  // ленты: список показывал её только после чего-нибудь ещё. Туда же — своё
  // членство (вступил, вышел на другом устройстве) и новое название группы.
  const reloadDialogs = (): void => scheduleLoadDialogs()
  matrixService.on('Room', reloadDialogs)
  matrixService.on('Room.myMembership', reloadDialogs)
  matrixService.on('Room.name', reloadDialogs)

  // Синк пришёл с разрывом: SDK начал ленту комнаты заново, пропущенное —
  // только на сервере, копия догрузит его сама.
  matrixService.on('Room.timelineReset', (room?: { roomId?: string }) => {
    if (room?.roomId) archive?.scheduleWalk(room.roomId)
  })

  // Квитанции о прочтении: по ним пересчитываются галочки «✓✓» (use-read-receipts).
  matrixService.on('Room.receipt', (_event: unknown, room?: { roomId?: string }) => {
    if (room?.roomId) chatStore.noteReceipt(room.roomId)
  })

  matrixService.on(
    'sync',
    (state: string, prevState?: string | null, data?: { error?: unknown }) => {
      uiStore.syncState = state
      if (state === 'ERROR') {
        const reason = syncErrorReason(data?.error)
        const key = REASON_KEY[reason.kind]
        const why = key ? t(key, { status: reason.status ?? '' }) : ''
        uiStore.syncError = why
          ? `${t('appMsg.messenger.syncError')}: ${why}`
          : t('appMsg.messenger.syncError')
        uiStore.syncErrorDetail = reason.detail || null
        // В кольцо последних ошибок — оно уходит в «Сведения о приложении».
        if (prevState !== 'ERROR') log.error('Ошибка синхронизации:', reason.kind, reason.detail)
        if (reason.kind === 'token') onTokenRejected?.()
        return
      }
      // Связь вернулась: то, что не расшифровалось без сети (профили с ключами
      // не загрузились), пробуем снова.
      if (state === 'SYNCING' && (prevState === 'ERROR' || prevState === 'RECONNECTING')) {
        chatStore.retryUndecrypted()
        scheduleLoadDialogs()
        archive?.scheduleAll()
      }
      // Баннер «Ошибка синхронизации» раньше гас только на 'PREPARED', а он
      // бывает раз за жизнь клиента — после восстановления связи (SYNCING)
      // надпись висела навсегда (S38).
      if (state === 'PREPARED' || state === 'SYNCING' || state === 'CATCHUP') {
        uiStore.syncError = null
        uiStore.syncErrorDetail = null
      }
      // Ответ синка принёс числа непрочитанных: прочитали на другом устройстве
      // или список встал из кэша — событий ленты при этом нет.
      if (state === 'SYNCING') {
        refreshUnreadCounts?.()
        archive?.kick()
      }
      if (state === 'PREPARED') {
        loadDialogs(true).then(() => {
          uiStore.dialogsLoadedOnce = true
          archive?.scheduleAll()
        })
      }
    }
  )
}
