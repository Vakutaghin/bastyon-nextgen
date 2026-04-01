// Константы компонента header-user

/** Интервал проверки статуса регистрации (мс) */
export const REGISTRATION_CHECK_INTERVAL = 30_000

/** Задержка перед показом мнемоника (мс) */
export const MNEMONIC_SHOW_DELAY = 3_000

/** Длина обрезки адреса для отображения */
export const ADDRESS_DISPLAY_LENGTH = 8

/** Поля профиля, в которых может быть баланс */
export const BALANCE_FIELDS = ['balance', 'wallet', 'amount', 'bal'] as const

/** Значения, означающие верификацию пользователя */
export const VERIFICATION_BADGES = ['verificated', 'verified'] as const
export const VERIFICATION_FLAG_VALUES = [1, '1', true, 'true'] as const
