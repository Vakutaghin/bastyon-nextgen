import { describe, it, expect } from 'vitest'
import { decodeExtHash, extPaymentMessage, parseExtLink, ExtLinkError } from './ext-payment'

const SHOP = 'PQ8AiCHJaTZAThr2TnpkQYDyVd1Hidq4PM'

/** Хэш ссылки, как его собирает SDK (`PaymentHash.makeURLHash`): JSON → hex. */
function extHash(params: Record<string, unknown>): string {
  const json = JSON.stringify(params)
  let hex = ''
  for (let i = 0; i < json.length; i++) {
    let ch = json.charCodeAt(i)
    if (ch > 0xff) ch -= 0x350
    hex += ch.toString(16).padStart(2, '0')
  }
  return '_' + hex
}

const pay = (params: Record<string, unknown>) => {
  const link = parseExtLink(extHash({ a: 'p', ad: SHOP, ...params }))
  if (link.action !== 'pay') throw new Error('not pay')
  return link.payment
}

const code = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ExtLinkError) return e.code
    throw e
  }
  return 'no error'
}

describe('decodeExtHash', () => {
  it('hex SDK с кириллицей (сдвиг 0x350) раскодируется обратно', () => {
    expect(decodeExtHash(extHash({ de: 'Чай и кружка', v: 1 }))).toEqual({
      de: 'Чай и кружка',
      v: 1,
    })
  })

  it('JSON в адресе без hex — тоже ссылка', () => {
    expect(decodeExtHash(encodeURI('{"ad":"x","v":2}'))).toEqual({ ad: 'x', v: 2 })
  })

  it('мусор — wrong:hash', () => {
    expect(code(() => decodeExtHash('_zz'))).toBe('wrong:hash')
    expect(code(() => decodeExtHash('_' + '5b5d'))).toBe('wrong:hash') // []
  })
})

describe('parseExtLink: pay', () => {
  it('сумма из товаров с количеством', () => {
    const p = pay({
      i: [
        { n: 'Чай', v: 0.5, c: 3 },
        { n: 'Кружка', v: 1 },
      ],
    })
    expect(p.value).toBe(2.5)
    expect(p.items).toEqual([
      { name: 'Чай', value: 0.5, count: 3 },
      { name: 'Кружка', value: 1, count: 1 },
    ])
  })

  it('соль, скидка и налог меняют сумму; до сатоши', () => {
    expect(pay({ v: 1, sav: 0.00000123, di: 0.1, ta: 0.05 }).value).toBe(0.95000123)
    // У прежнего клиента 0.5 не проходила (сравнение строк toFixed) — здесь проходит.
    expect(pay({ v: 1, sav: 0.5 }).value).toBe(1.5)
  })

  it('ошибки полей — коды прежнего клиента', () => {
    expect(code(() => pay({}))).toBe('missing:valueOritems')
    expect(code(() => pay({ v: 'x' }))).toBe('wrong:value:nan')
    expect(code(() => pay({ i: [{ v: 1 }] }))).toBe('missing:items:0:name')
    expect(code(() => pay({ i: [{ n: 'a', v: -1 }] }))).toBe('wrong:items:0:value:lessthanzero')
    expect(code(() => pay({ v: 1, sav: 1 }))).toBe('wrong:saltValue:morethan:1')
    expect(code(() => pay({ v: 1, sav: 0.000000001 }))).toBe('wrong:saltValue:8digitsRule')
    expect(code(() => pay({ v: 1, di: -1 }))).toBe('wrong:discount:lessthan:0')
    expect(code(() => pay({ v: 1, di: 1 }))).toBe('missing:value')
    expect(code(() => pay({ v: 1, st: { s: 'x.test' } }))).toBe('missing:store.name')
    expect(code(() => pay({ v: 1, ex: 60 }))).toBe('missing:date')
    expect(code(() => pay({ v: 1, c: 'javascript:alert(1)' }))).toBe('wrong:c_url:notvalid')
    expect(code(() => parseExtLink(extHash({ v: 1 })))).toBe('missing:address')
    expect(code(() => parseExtLink(extHash({ ad: 'PNotAnAddress', v: 1 })))).toBe(
      'wrong:address:notvalid'
    )
  })

  it('срок ссылки: дата + секунды', () => {
    expect(pay({ v: 1, d: 1_700_000_000_000, ex: 600 }).expiresAt).toBe(1_700_000_600_000)
  })

  it('обратный вызов: fetch по умолчанию, redirect по ct', () => {
    expect(pay({ v: 1, c: 'https://shop.test/paid' }).callback).toEqual({
      url: 'https://shop.test/paid',
      type: 'fetch',
    })
    expect(pay({ v: 1, c: 'https://shop.test/paid', ct: 'redirect' }).callback?.type).toBe(
      'redirect'
    )
  })

  it('анонимная ссылка не просит контактов и доставку', () => {
    const p = pay({ v: 1, an: 1, e: 1, p: 1, s: 'https://shop.test/ship' })
    expect(p.anonimus).toBe(true)
    expect(p.email).toBeUndefined()
    expect(p.phone).toBeUndefined()
    expect(p.shipment).toBeUndefined()
  })

  it('без действия — оплата; сообщение перевода pay_<h>', () => {
    const link = parseExtLink(extHash({ ad: SHOP, v: 1, h: 987654 }))
    expect(link.action).toBe('pay')
    expect(link.action === 'pay' && extPaymentMessage(link.payment)).toBe('pay_987654')
    expect(extPaymentMessage(pay({ v: 1 }))).toBe('')
  })
})

describe('parseExtLink: прочие действия', () => {
  it('auth отключён, как у прежнего клиента', () => {
    expect(code(() => parseExtLink(extHash({ a: 'a', c: 'https://x.test' })))).toBe(
      'application:ext:auth:deprecated'
    )
  })

  it('share: текст, ссылка, теги', () => {
    expect(
      parseExtLink(extHash({ a: 'share', de: 'Привет', u: 'https://x.test/p', tg: ['a', ''] }))
    ).toEqual({
      action: 'share',
      share: { description: 'Привет', url: 'https://x.test/p', tags: ['a'] },
    })
    expect(code(() => parseExtLink(extHash({ a: 'share', tg: 'a' })))).toBe('tags:array')
  })

  it('неизвестное действие — missing:action', () => {
    expect(code(() => parseExtLink(extHash({ a: 'zzz' })))).toBe('missing:action')
  })
})
