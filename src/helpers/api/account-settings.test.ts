import { describe, expect, it } from 'vitest'

import { paidSubscriptionPrice, parseAccountSettings } from './account-settings'

describe('parseAccountSettings', () => {
  it('разбирает JSON-строку из ответа ноды', () => {
    const raw = {
      result: 'success',
      data: '{"pin":"9aad","monetization":"","paidsubscription":3,"cover":""}',
    }
    expect(parseAccountSettings(raw)).toMatchObject({ paidsubscription: 3, pin: '9aad' })
  })

  it('пустая строка, мусор и массив — пустые настройки', () => {
    expect(parseAccountSettings({ data: '' })).toEqual({})
    expect(parseAccountSettings('{oops')).toEqual({})
    expect(parseAccountSettings(['x'])).toEqual({})
    expect(parseAccountSettings(null)).toEqual({})
  })

  it('объект без обёртки принимается как есть', () => {
    expect(parseAccountSettings({ cover: 'https://c' })).toEqual({ cover: 'https://c' })
  })
})

describe('paidSubscriptionPrice', () => {
  it('цена назначена — число PKOIN', () => {
    expect(paidSubscriptionPrice({ paidsubscription: 240 })).toBe(240)
    expect(paidSubscriptionPrice({ paidsubscription: '10' })).toBe(10)
  })

  it('не назначена, ноль или мусор — 0', () => {
    expect(paidSubscriptionPrice({})).toBe(0)
    expect(paidSubscriptionPrice({ paidsubscription: 0 })).toBe(0)
    expect(paidSubscriptionPrice({ paidsubscription: 'abc' })).toBe(0)
    expect(paidSubscriptionPrice({ paidsubscription: -5 })).toBe(0)
  })
})
