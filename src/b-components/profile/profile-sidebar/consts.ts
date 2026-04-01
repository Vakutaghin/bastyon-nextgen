// Константы компонента profile-sidebar

/** Имена полей в объекте профиля из RPC (сокращённые — особенность API) */
export const PROFILE_FIELDS = {
  AVATAR: 'i',
  AVATAR_SMALL: 's',
  AVATAR_BIG: 'b',
  ADDRESS: 'a',
  REPUTATION: 'r',
  POST_COUNT: 'postcnt',
} as const

/** Множитель для Unix timestamp → milliseconds */
export const TIMESTAMP_TO_MS = 1000

/** Количество знаков после запятой для репутации */
export const REPUTATION_PRECISION = 1
