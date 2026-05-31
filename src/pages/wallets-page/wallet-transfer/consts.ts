// Константы компонента перевода

/** Задержка дебаунса поиска получателя (мс) */
export const SEARCH_DEBOUNCE_MS = 300

/** Время показа статуса «Скопировано» (мс) */
export const COPIED_RESET_TIMEOUT = 2000

/** Регулярное выражение для валидации Pocketnet-адреса */
export const POCKETNET_ADDRESS_REGEX = /^[PZ][a-zA-Z0-9]{25,}$/

/**
 * Сообщения об ошибках. Значения — i18n-ключи домена `labels`;
 * резолвятся через t(...) в потребляющем компоненте.
 */
export const ERROR_MESSAGES = {
  INVALID_ADDRESS_FORMAT: 'labels.walletTransferInvalidAddressFormat',
  INVALID_ADDRESS: 'labels.walletTransferInvalidAddress',
  AMOUNT_LESS_THAN_FEE: 'labels.walletTransferAmountLessThanFee',
  AUTH_REQUIRED: 'labels.walletTransferAuthRequired',
  INSUFFICIENT_FUNDS: 'labels.walletTransferInsufficientFunds',
  SEND_FAILED: 'labels.walletTransferSendFailed',
} as const
