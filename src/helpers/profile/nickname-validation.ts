// Валидация ника: пустота, разрешённые символы, длина, зарезервированные слова.
// Общая для регистрации и смены имени в профиле — правила те же, что у старого
// клиента (kit.js UserInfo.validation + маска NICKNAME).

import { normalizeNickname, validateNickname } from '@/helpers/common/transliterate'
import { t } from '@/i18n'

/** Максимальная допустимая длина ника. */
export const NICKNAME_MAX_LENGTH = 20

/** Разрешённые символы ника: латиница, цифры, нижнее подчёркивание. */
const NICKNAME_PATTERN = /^[a-zA-Z0-9_]+$/

/** Результат валидации: либо null (всё ок), либо текст ошибки для UI. */
export type NicknameValidationError = string | null

/** Слова, которые нельзя брать в имя: имя проекта (старый клиент, kit.js). */
const RESERVED_NAME_PARTS = ['pocketnet', 'bastyon']

/** Имя содержит зарезервированное слово — сравнение только по буквам, как в старом клиенте. */
export function containsReservedName(nickname: string): boolean {
  const letters = nickname.toLowerCase().replace(/[^a-z]/g, '')
  return RESERVED_NAME_PARTS.some((part) => letters.includes(part))
}

/**
 * Полная валидация ника перед регистрацией. Возвращает текст ошибки или null.
 * Порядок проверок: непустой → паттерн → длина → зарезервированные слова.
 */
export function validateRegistrationNickname(nickname: string): NicknameValidationError {
  if (!nickname.trim()) return t('accountMsg.enterNickname')
  if (!NICKNAME_PATTERN.test(nickname)) {
    return t('accountMsg.nicknameInvalidChars')
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return t('accountMsg.nicknameTooLong', { max: NICKNAME_MAX_LENGTH })
  }
  if (containsReservedName(nickname)) return t('accountMsg.nicknameReserved')
  return null
}

/**
 * Смена имени в профиле: те же правила, что при регистрации. Неизменённое имя
 * пропускаем как есть — сохранение «О себе» не должно упираться в имя,
 * выданное по старым правилам (или официальному аккаунту со словом «bastyon»).
 * Раньше проверялись только пустота и длина, и «a/b» ломал ссылки `/:userName` (N26).
 */
export function validateProfileNickname(
  nickname: string,
  currentName?: string | null
): NicknameValidationError {
  if (currentName && nickname === currentName) return null
  return validateRegistrationNickname(nickname)
}

/** Быстрая boolean-проверка для disabled-флага формы (без сообщения об ошибке). */
export function isFormNicknameValid(nickname: string): boolean {
  return !!nickname.trim() && validateNickname(nickname)
}

/**
 * Нормализует ник и обрезает до NICKNAME_MAX_LENGTH.
 * Используется в debounced-onInput, чтобы пользователь видел уже валидный текст в поле.
 */
export function normalizeAndCapNickname(nickname: string): string {
  let normalized = normalizeNickname(nickname)
  if (normalized.length > NICKNAME_MAX_LENGTH) {
    normalized = normalized.substring(0, NICKNAME_MAX_LENGTH)
  }
  return normalized
}
