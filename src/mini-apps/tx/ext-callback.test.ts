import { describe, it, expect, vi } from 'vitest'
import { notifyMerchant } from './ext-callback'
import type { ExtPayment } from './ext-payment'

const base: ExtPayment = {
  address: 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM',
  value: 1,
  payload: { order: 42, tx: 'подмена' },
  callback: { url: 'https://shop.test/paid', type: 'fetch' },
}

const deps = (status = 200) => ({
  fetch: vi.fn(async () => new Response('{}', { status })),
  openExternal: vi.fn(async (_url: string) => {}),
})

describe('notifyMerchant', () => {
  it('fetch: POST JSON с tx, полями ссылки, контактами и адресом покупателя', async () => {
    const d = deps()
    await expect(notifyMerchant(base, 'tx-1', { email: 'a@b.c' }, 'PUser', d)).resolves.toBe(
      'fetch'
    )
    const [url, init] = d.fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://shop.test/paid')
    expect(init.method).toBe('POST')
    // tx из ссылки не подменяет настоящий.
    expect(JSON.parse(String(init.body))).toEqual({
      tx: 'tx-1',
      order: 42,
      email: 'a@b.c',
      account: 'PUser',
    })
  })

  it('анонимная ссылка — без адреса покупателя', async () => {
    const d = deps()
    await notifyMerchant({ ...base, anonimus: true }, 'tx-1', {}, 'PUser', d)
    const init = (d.fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).not.toHaveProperty('account')
  })

  it('магазин ответил ошибкой — исключение', async () => {
    await expect(notifyMerchant(base, 'tx-1', {}, 'PUser', deps(500))).rejects.toThrow(
      'merchant_http_500'
    )
  })

  it('redirect: те же поля в адресе страницы магазина', async () => {
    const d = deps()
    const r = await notifyMerchant(
      { ...base, callback: { url: 'https://shop.test/thanks?x=1', type: 'redirect' } },
      'tx-1',
      { phone: '+7 900' },
      'PUser',
      d
    )
    expect(r).toBe('redirect')
    expect(d.fetch).not.toHaveBeenCalled()
    const opened = new URL(d.openExternal.mock.calls[0]![0])
    expect(Object.fromEntries(opened.searchParams)).toEqual({
      x: '1',
      tx: 'tx-1',
      order: '42',
      phone: '+7 900',
      account: 'PUser',
    })
  })

  it('без адреса магазина — сообщать некуда', async () => {
    const d = deps()
    await expect(
      notifyMerchant({ ...base, callback: undefined }, 'tx-1', {}, null, d)
    ).resolves.toBe('none')
    expect(d.fetch).not.toHaveBeenCalled()
  })
})
