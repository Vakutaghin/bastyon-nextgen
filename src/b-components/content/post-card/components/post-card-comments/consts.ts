// Константы блока комментариев

/** Количество комментариев на одну «страницу» при пагинации */
export const COMMENTS_PAGE_SIZE = 15

/** Сколько комментариев уже показано в компактном виде (lastComment) */
export const COMMENTS_ALREADY_SHOWN = 1

/** Таймаут загрузки комментариев (мс) */
export const COMMENT_LOAD_TIMEOUT_MS = 25_000

/** Максимальное количество пользователей в списке @упоминаний */
export const MENTION_LIST_LIMIT = 15

/** Минимальная комиссия транзакции для отправки комментария/оценки */
export const COMMENT_TX_FEE = 0.00000001

/** Максимальная длина текста комментария (как в legacy: components/comments/index.js:2272) */
export const COMMENT_MAX_LENGTH = 915

/** Порог: при скольких оставшихся символах показывать счётчик */
export const COMMENT_LENGTH_WARN_THRESHOLD = 500

/** Веса для алгоритма сортировки «интересные» (1:1 с legacy: components/comments/index.js:1402-1448) */
export const SORT_WEIGHTS = {
  SCORE_UP: 250,
  CHILDREN: 450,
  /** children собственных комментариев получают этот множитель вместо CHILDREN */
  CHILDREN_MY: 4500,
  SCORE_DOWN_POSITIVE: 50,
  SCORE_DOWN_NEGATIVE: 1000,
  MESSAGE_LENGTH_MAX: 200,
  MESSAGE_LENGTH_MULTIPLIER: 3,
  REPUTATION_BASE: 100,
  REPUTATION_MULTIPLIER: 10,
  REPUTATION_DIVISOR: 20,
  DELETED_DIVISOR: 1300,
  TIME_BONUS: 3000,
  /** Множитель за прикреплённый донат (PKOIN amount) */
  DONATE_AMOUNT: 1000,
  /** Финальный множитель если автор поста = автор комментария */
  POST_AUTHOR_BOOST: 50,
  /** Финальный множитель для verified пользователей (по platform.real в легаси) */
  VERIFIED_BOOST: 1000,
  /** Финальный множитель для собственных комментариев */
  MY_COMMENT_BOOST: 20,
  /** Прибавка за активности юзера (activity.point * этот вес) */
  ACTIVITY_POINT: 10,
} as const
