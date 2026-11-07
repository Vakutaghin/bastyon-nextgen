/**
 * Сообщить магазину об оплате по ссылке `ext`, как прежний клиент
 * (`components/external` → `callbackPay`):
 *
 * - `fetch` (по умолчанию) — POST JSON `{tx, ...payload, phone?, email?, account?}`
 *   на адрес магазина; адрес покупателя (`account`) — только если ссылка не
 *   анонимная;
 * - `redirect` — тот же набор параметрами в адресе, страница магазина
 *   открывается в браузере.
 *
 * Перевод к этому моменту уже в сети: ошибка магазина платёж не отменяет.
 */

import type { ExtPayment } from './ext-payment'

export interface MerchantContacts {
  email?: string
  phone?: string
}

export interface MerchantCallbackDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  openExternal: (url: string) => Promise<void>
}

/** Сколько ждать ответ магазина. */
const MERCHANT_TIMEOUT_MS = 20_000

function fields(
  p: ExtPayment,
  tx: string,
  contacts: MerchantContacts,
  account: string | null
): Record<string, unknown> {
  const data: Record<string, unknown> = { tx }
  for (const [key, value] of Object.entries(p.payload ?? {})) {
    if (key !== 'tx') data[key] = value
  }
  if (contacts.phone) data.phone = contacts.phone
  if (contacts.email) data.email = contacts.email
  if (!p.anonimus && account) data.account = account
  return data
}

/** Что сделали: отправили магазину, открыли его страницу или сообщать некуда. */
export async function notifyMerchant(
  p: ExtPayment,
  tx: string,
  contacts: MerchantContacts,
  account: string | null,
  deps: MerchantCallbackDeps
): Promise<'fetch' | 'redirect' | 'none'> {
  if (!p.callback) return 'none'
  const data = fields(p, tx, contacts, account)

  if (p.callback.type === 'redirect') {
    const url = new URL(p.callback.url)
    for (const [key, value] of Object.entries(data)) {
      url.searchParams.append(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
    await deps.openExternal(url.toString())
    return 'redirect'
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), MERCHANT_TIMEOUT_MS)
  try {
    const res = await deps.fetch(p.callback.url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`merchant_http_${res.status}`)
    return 'fetch'
  } finally {
    clearTimeout(timer)
  }
}
