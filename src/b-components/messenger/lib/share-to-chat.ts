/**
 * «Поделиться → Отправить в чат»: в какие чаты можно отправить и каким
 * текстом. Ссылка — та же, что копирует «Поделиться»; мессенджер сам рисует
 * её карточкой (пост, видео, комментарий — PostEmbed; файл IPFS — карточкой
 * файла), а ссылку на профиль, коллекцию или мини-приложение открывает в
 * приложении (content-link).
 */

import { isMeshDialogId } from '@/mesh/ids'

import { isMeshTransport, type Dialog } from '../types'
import { isChannelChatId } from './channels'

/** Чат, в который можно отправить: переписка Matrix, в которую вы вступили. */
export function isShareTarget(dialog: Dialog): boolean {
  if (dialog.invite) return false
  // Mesh — радио: ссылка без интернета бесполезна, а эфир дорог. Канал — лента автора.
  if (isMeshTransport(dialog.transport) || isMeshDialogId(dialog.id)) return false
  return !isChannelChatId(dialog.id)
}

/**
 * Сообщения в чате идут открытым текстом: открытая группа или от 50 участников
 * (store/messenger-chat-store/encryption-rule). Личные чаты шифруются всегда.
 */
export function isOpenChat(dialog: Pick<Dialog, 'group'>): boolean {
  return !!dialog.group?.unencrypted
}

const normalize = (s: string): string => s.toLocaleLowerCase().replace(/ё/g, 'е').trim()

/**
 * Чаты для выбора: свежие сверху, как в списке чатов; `query` — по названию
 * или нику собеседника. `hidden` — спрятанные фильтром входящих: их нет и в
 * списке чатов, пока их не показали.
 */
export function shareTargets(
  dialogs: readonly Dialog[],
  query = '',
  hidden: ReadonlySet<string> = new Set()
): Dialog[] {
  const q = normalize(query)
  return dialogs
    .filter((d) => isShareTarget(d) && !hidden.has(d.id))
    .filter((d) => !q || normalize(d.partner.name || '').includes(q))
    .map((d, i) => ({ d, i, time: d.lastMessage?.timestamp ?? d.createdAt ?? 0 }))
    .sort((a, b) => b.time - a.time || a.i - b.i)
    .map(({ d }) => d)
}

/** Текст сообщения: подпись, если есть, и ссылка отдельной строкой. */
export function shareMessageText(link: string, comment = ''): string {
  const note = comment.trim()
  return note ? `${note}\n${link}` : link
}
