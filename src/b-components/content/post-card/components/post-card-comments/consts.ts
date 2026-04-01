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

/** Веса для алгоритма сортировки «интересные» */
export const SORT_WEIGHTS = {
  SCORE_UP: 250,
  CHILDREN: 450,
  SCORE_DOWN_POSITIVE: 50,
  SCORE_DOWN_NEGATIVE: 1000,
  MESSAGE_LENGTH_MAX: 200,
  MESSAGE_LENGTH_MULTIPLIER: 3,
  REPUTATION_BASE: 100,
  REPUTATION_MULTIPLIER: 10,
  REPUTATION_DIVISOR: 20,
  DELETED_DIVISOR: 1300,
  TIME_BONUS: 3000,
} as const
