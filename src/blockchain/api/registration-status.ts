/**
 * API для проверки статуса регистрации аккаунта
 * Аналог getStatus из оригинального приложения
 */

import { useAuthStore } from '@/blockchain/store/auth-store'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { rpcCall } from '@/helpers/api/request'
import { watch } from 'vue'

export type RegistrationStatus =
  | 'registered'
  | 'undefined_status'
  | 'in_progress_transaction'
  | 'in_progress_hasUnspents'
  | 'in_progress_wait_unspents'
  | 'not_in_progress'
  | 'not_in_progress_no_processing'

/**
 * Проверяет статус регистрации аккаунта
 * @returns Статус регистрации
 */
export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const authStore = useAuthStore()
  const address = authStore.getUserAddress

  if (!address) {
    return 'not_in_progress_no_processing'
  }

  let skipRpcCheck = false

  // OPTIMIZATION: If we are currently fetching the user state (which includes profile), wait for it
  // This prevents duplicate getuserprofile calls (one from here with auth: false, one from store with auth: true)
  if (authStore.isFetchingUserState) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isFetchingUserState,
        (newValue) => {
          if (!newValue) {
            unwatch()
            resolve()
          }
        }
      )
    })
  }

  // OPTIMIZATION: Check if profile is already loaded in store with a real ID
  // This avoids duplicate getuserprofile calls when profile is already loaded
  if (authStore.userProfile && authStore.userProfile.address === address && authStore.userProfile.id) {
    return 'registered'
  }
  // Для id=0 (stub после регистрации) — всегда делаем RPC проверку

  // Проверяем, зарегистрирован ли пользователь
  // В оригинальном приложении это проверяется через account.status.value
  // Здесь мы проверяем наличие userInfo в блокчейне через getuserprofile
  if (!skipRpcCheck) {
    try {
      // Используем getuserprofile для проверки наличия аккаунта в блокчейне
      // getuserprofile возвращает { result: "success", data: UserProfile[] }
      // Для незарегистрированного аккаунта сервер может вернуть пустой массив data
      // rpcCall unwraps { result, data } and throws on error,
      // so we receive the inner data directly.
      const profiles = await rpcCall<Array<{ address?: string; id?: number; name?: string; hash?: string }>>({
        method: rpcEndpoints.getUserProfile,
        parameters: [[address]], // getuserprofile принимает массив адресов в массиве параметров
        options: { auth: false },
      })

      // Проверяем, существует ли аккаунт в блокчейне
      // Аккаунт считается зарегистрированным, если getuserprofile возвращает массив с элементами
      // Это означает, что транзакция userInfo уже есть в блокчейне
      // Для верифицированных аккаунтов может не быть name, но они уже в блокчейне
      // В старом приложении проверка идет через account.status.value, который устанавливается
      // когда транзакция userInfo завершена, что означает наличие аккаунта в блокчейне

      // Упрощенная проверка: если есть хотя бы один элемент,
      // значит аккаунт уже в блокчейне (даже если у элемента нет name)
      const hasAccountInBlockchain =
        Array.isArray(profiles) &&
        profiles.length > 0

      if (hasAccountInBlockchain) {
        // Аккаунт уже в блокчейне - зарегистрирован
        // Модалка валидации не должна показываться для таких аккаунтов
        return 'registered'
      }
    } catch (error) {
      // P2-10: сбой getuserprofile — это НЕ «профиля нет». Раньше код проваливался
      // в unspents-проверку и мог классифицировать уже ЗАРЕГИСТРИРОВАННОГО как
      // «регистрация в процессе» (ложные часики + возобновление фоновой tx).
      // Пустой профиль (аккаунт не найден) сюда НЕ попадает — rpcCall отдаёт []
      // без throw и мы штатно уходим в unspents ниже. А сетевую ошибку не
      // понижаем: отдаём not_in_progress, проверка повторится на след. цикле.
      console.error('Failed to get registration status:', error)
      return 'not_in_progress'
    }
  }

  try {
    // Проверяем наличие userInfo транзакций
    // В оригинальном приложении это делается через getActions('userInfo')
    // Здесь мы проверяем наличие unspents и транзакций
    const { getUnspents, filterAvailableUnspents } = await import('@/blockchain/core/transactions/unspents-manager')
    const unspents = await getUnspents(address, 1, 9999999)
    const availableUnspents = filterAvailableUnspents(unspents, false)

    // Если есть unspents, значит транзакция может быть отправлена или уже отправлена
    if (availableUnspents.length > 0) {
      // Проверяем, есть ли транзакция userInfo в блокчейне
      // Если userInfo нет, но есть unspents, значит транзакция отправлена и ожидает подтверждения
      return 'in_progress_transaction'
    }

    // Если нет unspents, значит ожидаем их получения
    return 'in_progress_wait_unspents'
  } catch (unspentsError) {
    console.error('Failed to get unspents:', unspentsError)
    return 'undefined_status'
  }
}

/**
 * Проверяет, находится ли аккаунт в процессе регистрации
 * @returns true, если аккаунт в процессе регистрации
 */
export function isRegistrationInProgress(status: RegistrationStatus): boolean {
  return [
    'in_progress_transaction',
    'in_progress_hasUnspents',
    'in_progress_wait_unspents',
    'undefined_status',
  ].includes(status)
}
