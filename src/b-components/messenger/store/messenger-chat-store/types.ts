// Узкие локальные типы matrix-js-sdk, общие для модулей messenger-chat-store.
//
// matrixService.getClient()/getRoom() возвращают нетипизированный клиент SDK
// (services используют свои узкие типы), а helpers оперируют событиями как any.
// Тут описаны только те поля/методы Room/MatrixEvent, к которым реально обращаются
// модули чат-стора. Полные типы SDK (5к+ строк) намеренно не подключаем — см.
// services/matrix-service/types.ts.

import type { Ref } from 'vue'

import type { useAuthStore } from '@/blockchain'
import type { Message, User } from '../../types'
import type { useMessengerUiStore } from '../messenger-ui-store'
import type { useMessengerProfileCache } from '../messenger-profile-cache'

/** Минимальное подмножество RoomMember, используемое стором. */
export interface MxRoomMember {
  userId: string
  membership?: string
}

/** Секреты шифрования внутри content (block нужен типизированным для applyBlockToContent). */
export interface MxSecrets {
  block?: number
  keys?: string
  version?: number
  v?: number
}

/**
 * Подмножество m.audio-content для разбора url. url-поля динамичны (mxc/http,
 * вложенные file/info), поэтому помечены unknown — их разбирает extractUrl.
 */
export interface MxAudioContent {
  url?: unknown
  body?: unknown
  file?: { url?: unknown }
  info?: { url?: unknown; file?: { url?: unknown } }
}

/** Минимальное подмножество room.currentState / room.oldState. */
export interface MxRoomState {
  getStateEvents?: (type: string) => MxEvent[]
  getMembers?: () => MxRoomMember[]
}

/** Агрегатор реакций, возвращаемый relations.getChildEventsForEvent. */
export interface MxRelations {
  getSortedAnnotationsByKey?: () => Array<[string, Set<MxReactionEvent>]>
}

/** Событие-реакция: нас интересует только отправитель. */
export interface MxReactionEvent {
  getSender?: () => string
  sender?: string
}

/** Лента сообщений комнаты. */
export interface MxTimeline {
  getEvents: () => MxEvent[]
}

/** Минимальное подмножество Room, используемое стором. */
export interface MxRoom {
  currentState?: MxRoomState
  oldState?: MxRoomState
  relations?: {
    getChildEventsForEvent?: (
      eventId: string,
      relationType: string,
      eventType: string
    ) => MxRelations | null
  }
  getLiveTimeline?: () => MxTimeline
  loadMembersIfNeeded?: () => Promise<unknown>
}

/**
 * Минимальное подмножество MatrixEvent / сырого IEvent.
 * События приходят из helpers как нетипизированные объекты (getEvent* геттеры
 * работают и с обёрткой MatrixEvent, и с сырым `.event`), поэтому здесь все
 * поля опциональны и динамичны.
 */
export interface MxEvent {
  event?: Record<string, unknown>
  state_key?: string
  getStateKey?: () => string | undefined
}

/**
 * Разделяемое состояние и зависимости чат-стора, прокидываемые во все
 * use-* модули. Создаётся в корне стора (defineStore setup) и передаётся как
 * первый аргумент каждой composable-фабрики.
 *
 * `messages` и `currentUser` входят в публичный API стора; крипто-состояние
 * (pcryptoService/localMessengerKeys/кэши) живёт внутри use-chat-crypto.
 */
export interface ChatContext {
  /** Сообщения по chatId (reactive). */
  messages: Record<string, Message[]>
  /** Текущий пользователь (me). */
  currentUser: Ref<User>
  authStore: ReturnType<typeof useAuthStore>
  uiStore: ReturnType<typeof useMessengerUiStore>
  profileCache: ReturnType<typeof useMessengerProfileCache>
}
