import { describe, it, expect, vi } from 'vitest'
import { createCurrencyMethods } from './currency'

describe('createCurrencyMethods.fetchCurrencyRates', () => {
  it('отдаёт prices из exchanges/history, как старый клиент', async () => {
    const prices = { coingecko: [{ prices: { USD: { data: { price: '0.20' } } } }] }
    const fetchProxy = vi.fn(async () => ({ prices }))

    await expect(createCurrencyMethods({ fetchProxy }).fetchCurrencyRates()).resolves.toBe(prices)
    expect(fetchProxy).toHaveBeenCalledWith('exchanges/history')
  })

  it('без курсов в ответе — ошибка, а не пустой объект, похожий на курсы', async () => {
    const fetchProxy = vi.fn(async () => ({}))

    await expect(createCurrencyMethods({ fetchProxy }).fetchCurrencyRates()).rejects.toThrow(
      'currency:unavailable'
    )
  })
})
