/**
 * Типы для ответа RPC метода `searchusers`.
 *
 * Параметры запроса: [value, type='users', fixedBlock, start, count].
 * Возвращает массив минимальных объектов пользователей (как минимум — `address`).
 * Для отображения профиля (имя, аватар) обычно нужен дополнительный getuserprofile.
 */

import type { UserProfile } from './user-get'

/**
 * Минимальный результат поиска пользователя. На практике API часто
 * возвращает только `address`, а остальные поля подтягиваются отдельным
 * запросом профиля. Мы разрешаем оба варианта через Partial<UserProfile>.
 */
export interface SearchUserResult extends Partial<UserProfile> {
  address: string
}

export type SearchUsersData = SearchUserResult[]
