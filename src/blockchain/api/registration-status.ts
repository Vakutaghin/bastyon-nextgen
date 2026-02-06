/**
 * API для проверки статуса регистрации аккаунта
 * Аналог getStatus из оригинального приложения
 */

import { useAuthStore } from '@/blockchain/store/auth-store'
import { getByPRC } from '@/helpers/api/request'
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

  // OPTIMIZATION: Check if profile is already loaded in store
  // If we have a profile matching the address, we are definitely registered
  // This avoids duplicate getuserprofile calls at startup when profile is already loaded by fetchUserState
  if (authStore.userProfile && authStore.userProfile.address === address) {
    // If we have an ID, we are registered
    if (authStore.userProfile.id) {
      return 'registered'
    }

    // If we have a profile but no ID, it means the store fetched it and found nothing (unregistered)
    // So we can skip the RPC call and go straight to unspents check
    skipRpcCheck = true
  }

  // Проверяем, зарегистрирован ли пользователь
  // В оригинальном приложении это проверяется через account.status.value
  // Здесь мы проверяем наличие userInfo в блокчейне через getuserprofile
  if (!skipRpcCheck) {
    try {
      // Используем getuserprofile для проверки наличия аккаунта в блокчейне
      // getuserprofile возвращает { result: "success", data: UserProfile[] }
      // Для незарегистрированного аккаунта сервер может вернуть пустой массив data
      const userInfo = await getByPRC({
        method: 'getuserprofile',
        parameters: [[address]], // getuserprofile принимает массив адресов в массиве параметров
        options: { auth: false },
      }) as { result?: string; data?: Array<{ address?: string; id?: number; name?: string; hash?: string }> | null }

      // Проверяем, существует ли аккаунт в блокчейне
      // Аккаунт считается зарегистрированным, если getuserprofile возвращает массив с элементами
      // Это означает, что транзакция userInfo уже есть в блокчейне
      // Для верифицированных аккаунтов может не быть name, но они уже в блокчейне
      // В старом приложении проверка идет через account.status.value, который устанавливается
      // когда транзакция userInfo завершена, что означает наличие аккаунта в блокчейне

      // Упрощенная проверка: если result === 'success' и есть хотя бы один элемент в data,
      // значит аккаунт уже в блокчейне (даже если у элемента нет name)
      const hasAccountInBlockchain =
        userInfo?.result === 'success' &&
        Array.isArray(userInfo?.data) &&
        userInfo.data.length > 0

      if (hasAccountInBlockchain) {
        // Аккаунт уже в блокчейне - зарегистрирован
        // Модалка валидации не должна показываться для таких аккаунтов
        return 'registered'
      }
    } catch (error) {
      // Если произошла ошибка при запросе getuserprofile, это может означать:
      // 1. Аккаунт не найден в блокчейне (нормальная ситуация для незарегистрированного аккаунта)
      // 2. Проблема с сетью или сервером
      // В этом случае проверяем unspents, чтобы определить статус регистрации
      console.error('Failed to get registration status:', error)
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
