/**
 * Настройки аккаунта (accSet, RPC `getaccountsetting`): обложка, закреплённый
 * пост, цена платной подписки. Нода отдаёт их JSON-строкой; у аккаунта без
 * настроек — пустая строка.
 */

import { getByPRC } from './request'
import { rpcEndpoints } from './rpc-endpoints'

export interface AccountSettings {
  /** Цена платной подписки, PKOIN в месяц (0 — не задана). */
  paidsubscription?: number | string
  /** Обложка профиля. */
  cover?: string
  /** Закреплённый пост. */
  pin?: string
  [key: string]: unknown
}

/** Ответ ноды → объект настроек; мусор и пустота → `{}`. */
export function parseAccountSettings(raw: unknown): AccountSettings {
  let value: unknown =
    raw && typeof raw === 'object' && 'data' in raw ? (raw as { data?: unknown }).data : raw
  if (typeof value === 'string') {
    if (!value.trim()) return {}
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AccountSettings)
    : {}
}

/** Настройки аккаунта по адресу. Ошибку сети бросает — вызывающий решает, что показать. */
export async function fetchAccountSettings(address: string): Promise<AccountSettings> {
  const response = await getByPRC({
    method: rpcEndpoints.getAccountSetting,
    parameters: [address],
    options: { auth: false },
  })
  return parseAccountSettings(response)
}

/** Цена платной подписки; 0 — автор её не назначил (как `getcondition` старого клиента). */
export function paidSubscriptionPrice(settings: AccountSettings): number {
  const price = Number(settings.paidsubscription ?? 0)
  return Number.isFinite(price) && price > 0 ? price : 0
}
