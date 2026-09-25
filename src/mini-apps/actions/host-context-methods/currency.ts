/**
 * HostContext methods: курсы PKOIN для мини-апп (action `currency`).
 *
 * Как в старом клиенте: `app.api.fetch('exchanges/history').then(r => r.prices)`.
 * Прокси отдаёт `{ prices: { <источник>: [{ prices, date }, …] } }`. Раньше здесь
 * был пустой объект «вместо ошибки» — мини-аппа принимала его за курсы (N24).
 */

import type { HostContext } from '../host-context'

export interface CurrencyDeps {
  /** HTTP-запрос к прокси; ответ уже без обёртки `{ result, data }`. */
  fetchProxy: (path: string) => Promise<unknown>
}

export type CurrencyMethods = Pick<HostContext, 'fetchCurrencyRates'>

export function createCurrencyMethods(deps: CurrencyDeps): CurrencyMethods {
  return {
    fetchCurrencyRates: async () => {
      const history = (await deps.fetchProxy('exchanges/history')) as {
        prices?: Record<string, unknown>
      } | null
      if (!history?.prices || typeof history.prices !== 'object') {
        throw new Error('currency:unavailable')
      }
      return history.prices
    },
  }
}
