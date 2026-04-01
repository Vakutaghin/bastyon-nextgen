// Константы компонента перевода

/** Задержка дебаунса поиска получателя (мс) */
export const SEARCH_DEBOUNCE_MS = 300

/** Время показа статуса «Скопировано» (мс) */
export const COPIED_RESET_TIMEOUT = 2000

/** Регулярное выражение для валидации Pocketnet-адреса */
export const POCKETNET_ADDRESS_REGEX = /^[PZ][a-zA-Z0-9]{25,}$/

/** Сообщения об ошибках */
export const ERROR_MESSAGES = {
  INVALID_ADDRESS_FORMAT: 'Некорректный формат адреса кошелька',
  INVALID_ADDRESS: 'Некорректный адрес',
  AMOUNT_LESS_THAN_FEE: 'Сумма должна быть больше комиссии (получатель платит)',
  AUTH_REQUIRED: 'Требуется авторизация',
  INSUFFICIENT_FUNDS: 'Недостаточно средств для перевода с учётом комиссии',
  SEND_FAILED: 'Не удалось отправить перевод',
} as const
