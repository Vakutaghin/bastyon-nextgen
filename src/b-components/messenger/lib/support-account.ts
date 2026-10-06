/**
 * Аккаунт поддержки в сети Bastyon: на него уходят баг-репорты из шапки, и
 * только в чате с ним есть кнопка «Сведения о приложении».
 *
 * Храним имя, а не адрес: имя резолвится в адрес через getuseraddress (как на
 * странице профиля) — никаких посредников, всё через ноду. Адрес запоминается
 * на устройстве: он публичный, а без него кнопка в чате появлялась бы только
 * после ответа ноды и сдвигала переписку.
 */

import { ref, readonly } from 'vue'

import { getByPRC } from '@/helpers/api/request'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import type { GetUserAddressResponse } from '@/types/rpc-responses/get-user-address'

export const SUPPORT_ACCOUNT_NAME = 'bastyon_nextgen_supp'

const STORAGE_KEY = 'bastyon_support_address'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

function writeStored(address: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, address)
  } catch {
    /* хранилище недоступно — спросим ноду в следующий раз */
  }
}

const address = ref<string | null>(readStored())
/** Адрес из памяти устройства, а в этом запуске нода его ещё не подтвердила. */
let confirmed = false
let pending: Promise<string | null> | null = null

/** Известный адрес поддержки (реактивно); `null`, пока нода не ответила ни разу. */
export const supportAddress = readonly(address)

/**
 * Адрес поддержки. Кешируем ТОЛЬКО успешный резолв. Пустой ответ (имя свежего
 * аккаунта ещё не распространилось по всем нодам) или ошибку не кешируем —
 * иначе один промах убивал бы кнопку до перезагрузки страницы.
 */
export function resolveSupportAddress(): Promise<string | null> {
  if (confirmed && address.value) return Promise.resolve(address.value)
  if (pending) return pending

  pending = getByPRC({
    method: rpcEndpoints.getUserAddress,
    parameters: [SUPPORT_ACCOUNT_NAME],
    options: { auth: false },
  })
    .then((response) => (response as GetUserAddressResponse)?.data?.[0]?.address ?? null)
    .catch((error) => {
      console.warn('[support] не удалось разрешить адрес аккаунта поддержки:', error)
      return null
    })
    .then((resolved) => {
      pending = null
      if (!resolved) return address.value
      confirmed = true
      if (resolved !== address.value) {
        address.value = resolved
        writeStored(resolved)
      }
      return resolved
    })

  return pending
}

/** Для тестов. */
export function resetSupportAccount(): void {
  address.value = readStored()
  confirmed = false
  pending = null
}
