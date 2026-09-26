// Список диалогов с прошлого запуска. Показывается сразу после входа в аккаунт,
// пока Matrix логинится, синхронизируется и расшифровывает последние сообщения,
// а после первого синка заменяется свежим. Без него первое открытие мессенджера
// после запуска упиралось в «Загрузку диалогов».
//
// Хранение: localStorage `BST_MSG_DIALOGS_<ownAddress>` → { v, dialogs }.
// Отдельно на каждый аккаунт, как пины ключей: список собеседников не должен
// светиться другому аккаунту на устройстве. В превью лежит расшифрованный текст
// последнего сообщения — те же данные, что в IndexedDB-кэше расшифровок.
// Стирается при выходе (clearAllUserData) и удалении аккаунта
// (clearAccountScopedLocalData).

import { MESSENGER_DIALOGS_PREFIX } from '@/blockchain/constants/storage'

import type { Dialog, Message } from '../../types'

const VERSION = 1
/** Строка списка показывает превью в одну строку — длиннее хранить незачем. */
const PREVIEW_MAX_LENGTH = 200
/** Остальные диалоги подтянет первый синк. */
const MAX_DIALOGS = 100

const keyFor = (address: string): string => `${MESSENGER_DIALOGS_PREFIX}${address}`

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Только то, что рисует строка списка: без вложений, реакций и сырого контента. */
function trimMessage(m: Message): Message {
  return {
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    text: (m.text || '').slice(0, PREVIEW_MAX_LENGTH),
    type: m.type,
    timestamp: m.timestamp,
    read: m.read,
    status: m.status,
  }
}

function trimDialog(d: Dialog): Dialog {
  const { id, name, avatar, verified } = d.partner
  return {
    id: d.id,
    partner: { id, name, avatar, verified },
    unreadCount: d.unreadCount,
    lastMessage: d.lastMessage ? trimMessage(d.lastMessage) : undefined,
    createdAt: d.createdAt,
  }
}

function isDialog(value: unknown): value is Dialog {
  const d = value as Dialog | null
  return (
    !!d &&
    typeof d.id === 'string' &&
    typeof d.partner?.id === 'string' &&
    typeof d.unreadCount === 'number'
  )
}

export function loadDialogsSnapshot(address: string): Dialog[] {
  const s = storage()
  if (!s || !address) return []
  try {
    const raw = s.getItem(keyFor(address))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { v?: unknown; dialogs?: unknown }
    if (parsed?.v !== VERSION || !Array.isArray(parsed.dialogs)) return []
    return parsed.dialogs.filter(isDialog)
  } catch {
    return []
  }
}

/** Пустой список стирает снимок: последний диалог удалили — показывать нечего. */
export function saveDialogsSnapshot(address: string, dialogs: Dialog[]): void {
  const s = storage()
  if (!s || !address) return
  try {
    if (dialogs.length === 0) {
      s.removeItem(keyFor(address))
      return
    }
    const json = JSON.stringify({
      v: VERSION,
      dialogs: dialogs.slice(0, MAX_DIALOGS).map(trimDialog),
    })
    // Список перестраивается на каждое новое сообщение, а меняется реже.
    if (s.getItem(keyFor(address)) !== json) s.setItem(keyFor(address), json)
  } catch {
    /* квота или запрет хранилища — без снимка список просто появится позже */
  }
}
