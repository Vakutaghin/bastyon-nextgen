/**
 * Платёж по ссылке (`sdk.ext(payment)` → действие `ext`): разбор и проверка,
 * как у прежнего клиента (`sdk.external.getFromHash` + `expandLink`).
 *
 * SDK кодирует платёж короткими ключами (`a` действие, `ad` адрес, `v` сумма,
 * `i` товары, `c` адрес обратного вызова магазина…), JSON → hex с префиксом
 * `_` (`PaymentHash.makeURLHash`). Хэш `h` (adler32 полей платежа) уходит в
 * сообщение перевода `pay_<h>`: по нему магазин находит оплату в сети.
 *
 * Не поддерживаем: `auth` (у прежнего клиента тоже отключён) и расчёт доставки
 * (`s_url`: форма адреса и запрос цены у магазина) — такая ссылка получает
 * отказ, а не оплату без доставки.
 */

import { isValidAddress } from '@/blockchain/core/addresses/address-validator'

export interface ExtItem {
  name: string
  value: number
  count: number
  image?: string
}

export interface ExtPayment {
  address: string
  /** Сколько платить: товары или сумма, с солью, скидкой и налогом. */
  value: number
  description?: string
  /** `h` ссылки: сообщение перевода — `pay_<h>`. */
  paymentHash?: string
  items?: ExtItem[]
  store?: { name: string; site?: string }
  /** Когда ссылка перестаёт действовать (мс); нет — бессрочная. */
  expiresAt?: number
  /** Куда сообщить магазину об оплате. */
  callback?: { url: string; type: 'fetch' | 'redirect' }
  /** Магазин просит почту / телефон покупателя. */
  email?: boolean
  phone?: boolean
  /** Магазину не сообщать адрес покупателя. */
  anonimus?: boolean
  payload?: Record<string, unknown>
  shipment?: boolean
}

export interface ExtShare {
  description?: string
  url?: string
  tags?: string[]
}

export type ExtLink = { action: 'pay'; payment: ExtPayment } | { action: 'share'; share: ExtShare }

/** Ошибка ссылки; `code` — как у прежнего клиента (`missing:address`, `wrong:value:nan`…). */
export class ExtLinkError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ExtLinkError'
  }
}

const fail = (code: string): never => {
  throw new ExtLinkError(code)
}

/** hex прежнего клиента: байт ≥ 128 — буква кириллицы со сдвигом 0x350. */
function hexDecode(hex: string): string {
  let out = ''
  for (let i = 2; i <= hex.length; i += 2) {
    let ch = parseInt(hex.substring(i - 2, i), 16)
    if (Number.isNaN(ch)) fail('wrong:hash')
    if (ch >= 128) ch += 0x350
    out += String.fromCharCode(ch)
  }
  return out
}

export function decodeExtHash(ext: string): Record<string, unknown> {
  const trimmed = ext.trim()
  let json: unknown
  try {
    json = JSON.parse(trimmed.startsWith('_') ? hexDecode(trimmed.slice(1)) : decodeURI(trimmed))
  } catch (e) {
    if (e instanceof ExtLinkError) throw e
    fail('wrong:hash')
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) fail('wrong:hash')
  return json as Record<string, unknown>
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
/** Сумма в PKOIN до сатоши. */
const coins = (v: number): number => Math.round(v * 1e8) / 1e8

function httpUrl(v: unknown, code: string): string {
  try {
    const url = new URL(String(v))
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
  } catch {
    // ниже
  }
  return fail(code)
}

function parsePay(j: Record<string, unknown>): ExtPayment {
  const address = text(j.ad ?? j.address, 64)
  if (!address) fail('missing:address')
  if (!isValidAddress(address!)) fail('wrong:address:notvalid')

  const anonimus = !!j.an
  const p: ExtPayment = { address: address!, value: 0, anonimus }
  if (!anonimus) {
    if (j.e) p.email = true
    if (j.p) p.phone = true
    if (j.s) p.shipment = true
  }

  const rawItems = j.i
  if (Array.isArray(rawItems) && rawItems.length) {
    let sum = 0
    p.items = rawItems.map((raw, i) => {
      const it = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const name = text(it.n, 200)
      if (!name) fail(`missing:items:${i}:name`)
      if (!it.v) fail(`missing:items:${i}:value`)
      if (!isNum(it.v)) fail(`wrong:items:${i}:value:nan`)
      if ((it.v as number) < 0) fail(`wrong:items:${i}:value:lessthanzero`)
      if (it.c !== undefined && !isNum(it.c)) fail(`wrong:items:${i}:count:nan`)
      const count = isNum(it.c) && it.c > 0 ? it.c : 1
      sum += count * (it.v as number)
      const item: ExtItem = { name: name!, value: it.v as number, count }
      const image = text(it.i, 1000)
      if (image) item.image = image
      return item
    })
    p.value = sum
  } else {
    if (j.v === undefined || j.v === null || j.v === 0 || j.v === '') fail('missing:valueOritems')
    if (!isNum(j.v)) fail('wrong:value:nan')
    p.value = j.v as number
  }

  if (j.sav) {
    const salt = j.sav
    if (!isNum(salt)) fail('wrong:saltValue:nan')
    if ((salt as number) >= 1) fail('wrong:saltValue:morethan:1')
    if ((salt as number) <= -1) fail('wrong:saltValue:lessthan:-1')
    // Не точнее сатоши (у прежнего клиента — сравнение строк toFixed(8),
    // которое отвергало и 0.5).
    const sats = (salt as number) * 1e8
    if (Math.abs(sats - Math.round(sats)) > 1e-6) fail('wrong:saltValue:8digitsRule')
    p.value += salt as number
  }
  if (j.di) {
    if (!isNum(j.di)) fail('wrong:discount:nan')
    if ((j.di as number) < 0) fail('wrong:discount:lessthan:0')
    p.value -= j.di as number
  }
  if (j.ta) {
    if (!isNum(j.ta)) fail('wrong:tax:nan')
    if ((j.ta as number) < 0) fail('wrong:tax:lessthan:0')
    p.value += j.ta as number
  }

  const st = j.st
  if (st && typeof st === 'object') {
    const s = st as Record<string, unknown>
    const name = text(s.n, 200)
    if (!name) fail('missing:store.name')
    p.store = { name: name! }
    const site = text(s.s, 300)
    if (site) p.store.site = site
  }

  if (j.ex) {
    if (!j.d) fail('missing:date')
    if (!isNum(j.ex) || !isNum(j.d)) fail('wrong:expired:nan')
    p.expiresAt = (j.d as number) + (j.ex as number) * 1000
  }

  const description = text(j.de ?? j.description, 1000)
  if (description) p.description = description
  const hash = j.h ?? j.paymentHash
  if (typeof hash === 'string' || isNum(hash)) {
    const h = String(hash).trim()
    if (h && /^[0-9A-Za-z_-]{1,64}$/.test(h)) p.paymentHash = h
  }
  if (j.c) {
    p.callback = {
      url: httpUrl(j.c, 'wrong:c_url:notvalid'),
      type: j.ct === 'redirect' ? 'redirect' : 'fetch',
    }
  }
  if (j.pl && typeof j.pl === 'object' && !Array.isArray(j.pl)) {
    p.payload = j.pl as Record<string, unknown>
  }

  p.value = coins(p.value)
  if (!(p.value > 0)) fail('missing:value')
  return p
}

function parseShare(j: Record<string, unknown>): ExtShare {
  const share: ExtShare = {}
  const description = text(j.de ?? j.description, 2000)
  if (description) share.description = description
  if (j.u) share.url = httpUrl(j.u, 'wrong:url:notvalid')
  if (j.tg !== undefined) {
    if (!Array.isArray(j.tg)) fail('tags:array')
    share.tags = (j.tg as unknown[]).map((t) => text(t, 40)).filter((t): t is string => !!t)
  }
  return share
}

export function parseExtLink(ext: string): ExtLink {
  const j = decodeExtHash(ext)
  const a = j.a ?? j.action
  const action = a === 'p' || a === undefined ? 'pay' : a === 'a' ? 'auth' : String(a)
  if (action === 'auth') fail('application:ext:auth:deprecated')
  if (action === 'share') return { action: 'share', share: parseShare(j) }
  if (action !== 'pay') fail('missing:action')
  return { action: 'pay', payment: parsePay(j) }
}

/** Сообщение перевода: по нему магазин находит оплату (`pay_<h>`). */
export function extPaymentMessage(p: ExtPayment): string {
  return p.paymentHash ? `pay_${p.paymentHash}` : ''
}
