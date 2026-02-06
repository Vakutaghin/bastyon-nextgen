import type { BaseRpcResponse } from './common'

/**
 * Типы для ответа getuseraddress API
 *
 * # getuseraddress - получение адреса пользователя по имени
 *
 * ## Когда использовать getuseraddress:
 *
 * ✅ **Используйте для:**
 * - Разрешения имени пользователя (например, "kolobok_iz_odessi") в адрес (P...)
 * - Проверки существования пользователя с таким именем
 *
 * **Пример использования:**
 * ```typescript
 * const response = await getByPRC({
 *   method: 'getuseraddress',
 *   parameters: ['kolobok_iz_odessi'],
 *   options: { auth: false }
 * })
 * ```
 */

/**
 * Данные адреса пользователя
 */
export interface UserAddressData {
  /** Имя пользователя */
  name: string
  /** Адрес пользователя (Pocketnet адрес, начинается с 'P') */
  address: string
}

/**
 * Ответ RPC метода getuseraddress
 * Возвращает массив найденных пользователей (обычно один элемент при точном совпадении)
 */
export interface GetUserAddressResponse extends BaseRpcResponse<UserAddressData[]> {}
