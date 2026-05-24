/**
 * Карта Pocketnet-кодов типов транзакций (поле type) → человеко-читаемое имя.
 *
 * Источник истины — vout[0].scriptPubKey.hex (OP_RETURN <label> <data>). Метки,
 * помеченные «verified», взяты из реальных tx на mainnet; остальные — предположения
 * по pocketnet.core::PocketTx.h, которые будут заменены на verified-метки по мере
 * встречаемости в реальных данных.
 *
 * Если код неизвестен — отдаём 'Тип ' + код.
 */

export const POCKET_TX_TYPES: Record<number, string> = {
  // Базовые Bitcoin / PoS
  1: 'Coinbase',
  2: 'Coinstake',
  3: 'PoS reward',         // verified: vin[0].address === vout[1].addresses[0]
  4: 'Default',

  // Account
  100: 'AccountSetting',   // verified: OP_RETURN "userInfo"
  101: 'Account',
  102: 'AccountUser',
  103: 'AccountSet',       // verified: OP_RETURN "accSet"
  104: 'AccountBarteron',

  // Content
  200: 'Post',             // verified: OP_RETURN "share"
  201: 'Video',            // verified: OP_RETURN "video"
  202: 'Article',
  203: 'Stream',
  204: 'Comment',          // verified: OP_RETURN "comment"
  205: 'CommentEdit',      // verified: OP_RETURN "commentEdit"
  206: 'ContentDelete',
  207: 'CommentDelete',
  208: 'Audio',
  209: 'Collection',

  // Scoring
  300: 'UpvoteShare',      // verified: OP_RETURN "upvoteShare"
  301: 'cScore',           // verified: OP_RETURN "cScore"

  // Subscriptions
  302: 'Subscribe',
  303: 'SubscribePrivate',
  304: 'Unsubscribe',      // verified: OP_RETURN "unsubscribe"

  // Blocking
  305: 'Blocking',
  306: 'Unblocking',

  // Boost / Complain
  307: 'BoostContent',
  308: 'Complain',

  // Moderation
  400: 'ModerationFlag',
  401: 'ModerationVote',

  // Barteron
  211: 'BarteronAccount',
  212: 'BarteronOffer',
  213: 'BarteronOfferDelete',
  214: 'BarteronRequest',
}

export function labelForTxType(type: number): string {
  return POCKET_TX_TYPES[type] ?? `Тип ${type}`
}
