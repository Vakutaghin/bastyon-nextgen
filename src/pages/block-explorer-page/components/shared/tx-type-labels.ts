/**
 * Карта Pocketnet-кодов типов транзакций (поле type) → человеко-читаемое имя.
 *
 * Коды — из pocketnet.core (PocketTx). Помеченные «verified» сверены с
 * транзакциями mainnet 22.10.2026 по первой метке OP_RETURN (в скобках);
 * остальные на mainnet не встретились и взяты из кода ноды.
 *
 * До 22.10.2026 таблица была сдвинута: 1 значился Coinbase, 208 — Audio,
 * 307 — BoostContent, и обозреватель подписывал переводы и бусты чужими
 * именами.
 *
 * Если код неизвестен — отдаём 'Тип ' + код.
 */

import { t } from '@/i18n'

export const POCKET_TX_TYPES: Record<number, string> = {
  // Монеты
  1: 'Transfer', // verified: переводы, без OP_RETURN или с сообщением
  2: 'Coinbase',
  3: 'Coinstake', // verified: vout[0] пустой, дальше ставщик и лотерея

  // Аккаунт
  100: 'AccountUser', // verified ("userInfo")
  101: 'AccountVideoServer',
  102: 'AccountMessageServer',
  103: 'AccountSetting', // verified ("accSet")
  104: 'BarteronAccount', // verified ("brtaccount")
  170: 'AccountDelete',

  // Контент
  200: 'Post', // verified ("share")
  201: 'Video', // verified ("video")
  202: 'Article', // verified ("article")
  204: 'Comment', // verified ("comment")
  205: 'CommentEdit', // verified ("commentEdit")
  206: 'CommentDelete', // verified ("commentDelete")
  207: 'ContentDelete', // verified ("contentDelete")
  208: 'BoostContent', // verified ("contentBoost")
  209: 'Stream',
  210: 'Audio', // verified ("audio")
  211: 'BarteronOffer', // verified ("brtoffer")
  220: 'Collection',
  221: 'MiniApp', // verified ("miniapp")

  // Оценки
  300: 'UpvoteShare', // verified ("upvoteShare")
  301: 'CommentScore', // verified ("cScore")

  // Подписки
  302: 'Subscribe', // verified ("subscribe")
  303: 'SubscribePrivate', // verified ("subscribePrivate")
  304: 'Unsubscribe', // verified ("unsubscribe")

  // Блокировки и жалобы
  305: 'Blocking', // verified ("blocking")
  306: 'Unblocking', // verified ("unblocking")
  307: 'Complain', // verified ("complainShare")

  // Модерация
  400: 'ModeratorRequestSubs',
  401: 'ModeratorRequestCoin',
  402: 'ModeratorRequestCancel',
  410: 'ModerationFlag', // verified ("modFlag")
  420: 'ModerationVote', // verified ("modVote")
}

export function labelForTxType(type: number): string {
  return POCKET_TX_TYPES[type] ?? t('explorerShared.txTypeUnknown', { type })
}
