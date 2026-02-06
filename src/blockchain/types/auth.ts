/**
 * Типы для состояния авторизации
 */

import type { KeyPair } from './keys'
import type { Address } from './addresses'
import type { UserProfile } from '../../types/rpc-responses/user-get'

/**
 * Состояние авторизации пользователя
 */
export type AuthState = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error'

/**
 * Состояние пользователя
 */
export interface UserState {
  /** Авторизован ли пользователь */
  isAuthenticated: boolean
  /** Состояние авторизации */
  authState: AuthState
  /** Адрес пользователя */
  address: Address | null
  /** Ключевая пара (только в памяти, не сохраняется) */
  keyPair: KeyPair | null
  /** Профиль пользователя */
  userProfile: UserProfile | null
  /** Загрузка данных */
  isLoading: boolean
  /** Ошибка авторизации */
  error: string | null
  /** Выполняется ли запрос fetchUserState (для предотвращения дублирующих запросов) */
  isFetchingUserState?: boolean
}

/**
 * Результат входа
 */
export interface SignInResult {
  /** Успешно авторизован */
  success: boolean
  /** Адрес пользователя */
  address?: Address
  /** Сообщение об ошибке */
  error?: string
}

/**
 * Результат регистрации
 */
export interface RegistrationResult {
  /** Мнемоническая фраза (показать пользователю для сохранения) */
  mnemonic: string
  /** Адрес пользователя */
  address: Address
  /** Ключевая пара */
  keyPair: KeyPair
}

/**
 * Опции для входа
 */
export interface SignInOptions {
  /** Приватный ключ или мнемоническая фраза */
  privateKey: string
  /** Автоматически восстановить сессию */
  restoreSession?: boolean
}

/**
 * Опции для регистрации
 */
export interface RegistrationOptions {
  /** Генерировать новую мнемонику или использовать существующую */
  generateNew?: boolean
  /** Сохранить после регистрации */
  saveAfterRegistration?: boolean
}

/**
 * Информация об аккаунте для мульти-аккаунтов
 */
export interface AccountInfo {
  /** Адрес аккаунта */
  address: Address
  /** Зашифрованная мнемоника или приватный ключ */
  encryptedMnemonic: string
  /** Время последнего использования */
  lastUsed: number
  /** Имя аккаунта (опционально, для отображения) */
  name?: string
}

/**
 * Список аккаунтов
 */
export interface AccountsList {
  /** Список аккаунтов */
  accounts: AccountInfo[]
  /** Адрес текущего активного аккаунта */
  currentAccount: Address | null
}
