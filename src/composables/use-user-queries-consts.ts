// Константы для composables пользовательских запросов

/** 1 PKOIN = 100 000 000 сатоши */
export const SATOSHI_PER_PKOIN = 100_000_000

/** Минимальное количество подтверждений для txunspent */
export const MIN_CONFIRMATIONS = 1

/** Максимальное количество подтверждений для txunspent */
export const MAX_CONFIRMATIONS = 9_999_999

// --- Время жизни кэша (staleTime / gcTime) ---

/** Профиль пользователя — 5 мин / 10 мин */
export const STALE_TIME_USER_PROFILE = 5 * 60 * 1000
export const GC_TIME_USER_PROFILE = 10 * 60 * 1000

/** Состояние пользователя (лимиты) — 2 мин / 5 мин (обновляется чаще) */
export const STALE_TIME_USER_STATE = 2 * 60 * 1000
export const GC_TIME_USER_STATE = 5 * 60 * 1000

/** Баланс кошелька — 30 сек / 5 мин (самый частый) */
export const STALE_TIME_WALLET_BALANCE = 30 * 1000
export const GC_TIME_WALLET_BALANCE = 5 * 60 * 1000

/** Язык по умолчанию для API-запросов */
export const DEFAULT_LANGUAGE = 'en'
