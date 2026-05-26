/**
 * Chat handlers (этап 5.7):
 *
 * - `chat.getOrCreateRoom` — создать/получить Matrix room с пользователями
 * - `chat.send` — отправить сообщение в room
 * - `chat.openRoom` — открыть room в UI
 *
 * Legacy эквиваленты — [index.js:730-805](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L730-L805).
 *
 * MVP: `openRoom` работает (просто навигация в /messages?room=...), а
 * `getOrCreateRoom` и `send` бросают `chat_*_not_implemented` пока не
 * подключим nextgen Matrix-клиент к миниаппам напрямую.
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const getOrCreateRoom: ActionDefinition<
  { users: string[]; parameters?: unknown },
  Record<string, unknown>
> = {
  schema: ActionSchemas['chat.getOrCreateRoom'],
  permissions: ['chat'],
  authorization: true,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.chatGetOrCreateRoom(data.users, data.parameters),
}

const send: ActionDefinition<{ roomid: string; content: unknown }, Record<string, unknown>> = {
  schema: ActionSchemas['chat.send'],
  permissions: ['chat'],
  authorization: true,
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.chatSendMessage(data.roomid, data.content),
}

const openRoom: ActionDefinition<{ roomid: string }, void> = {
  schema: ActionSchemas['chat.openRoom'],
  permissions: ['chat'],
  rateLimitClass: 'normal',
  handler: async ({ data, host }) => host.chatOpenRoom(data.roomid),
}

export const CHAT_ACTIONS = {
  'chat.getOrCreateRoom': getOrCreateRoom,
  'chat.send': send,
  'chat.openRoom': openRoom,
} as const satisfies ActionMap
