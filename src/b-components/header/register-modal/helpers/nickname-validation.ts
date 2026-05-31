// Валидация ника при регистрации: пустота, разрешённые символы, длина.
// Дополняет общий validateNickname() конкретными сообщениями об ошибках,
// которые показываются в register-modal.

import { normalizeNickname, validateNickname } from '@/helpers/common/transliterate'
import { t } from '@/i18n'

/** Максимальная допустимая длина ника. */
export const NICKNAME_MAX_LENGTH = 20

/** Разрешённые символы ника: латиница, цифры, нижнее подчёркивание. */
const NICKNAME_PATTERN = /^[a-zA-Z0-9_]+$/

/** Результат валидации: либо null (всё ок), либо текст ошибки для UI. */
export type NicknameValidationError = string | null

/**
 * Полная валидация ника перед регистрацией. Возвращает текст ошибки или null.
 * Порядок проверок: непустой → паттерн → длина.
 */
export function validateRegistrationNickname(nickname: string): NicknameValidationError {
  if (!nickname.trim()) return t('accountMsg.enterNickname')
  if (!NICKNAME_PATTERN.test(nickname)) {
    return t('accountMsg.nicknameInvalidChars')
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return t('accountMsg.nicknameTooLong', { max: NICKNAME_MAX_LENGTH })
  }
  return null
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
