import { describe, it, expect } from 'vitest'
import {
  donationCurrencyLabel,
  isValidDonationAddress,
  parseDonationAddresses,
} from './donation-addresses'

describe('parseDonationAddresses', () => {
  it('читает обычный список', () => {
    expect(
      parseDonationAddresses('[{"currency":"btc","address":"1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}]')
    ).toEqual([{ currency: 'btc', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' }])
  })

  it('разворачивает вложенные строки старых клиентов и убирает повторы', () => {
    const inner = JSON.stringify([{ currency: 'btc', address: 'A' }])
    const raw = JSON.stringify([inner, { currency: 'btc', address: 'A' }, '[]'])
    expect(parseDonationAddresses(raw)).toEqual([{ currency: 'btc', address: 'A' }])
    expect(parseDonationAddresses('["[]"]')).toEqual([])
  })

  it('пустое и испорченное поле — пустой список', () => {
    expect(parseDonationAddresses(undefined)).toEqual([])
    expect(parseDonationAddresses('')).toEqual([])
    expect(parseDonationAddresses('{oops')).toEqual([])
    expect(parseDonationAddresses('[{"currency":1}]')).toEqual([])
  })
})

describe('isValidDonationAddress', () => {
  it.each([
    ['btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
    ['btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
    ['btc', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'],
    ['eth', '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'],
    ['usdt|erc20', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
    ['usdt|trc20', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'],
    ['xmr', '4' + '8'.repeat(94)],
    ['doge', 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L'],
  ])('%s: %s — годится', (currency, address) => {
    expect(isValidDonationAddress(currency, address)).toBe(true)
  })

  it.each([
    ['btc', 'user@example.com'],
    ['btc', '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'],
    ['eth', '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BA'],
    ['usdt|trc20', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6'],
    ['btc', ''],
    ['unknown', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
  ])('%s: %s — не годится', (currency, address) => {
    expect(isValidDonationAddress(currency, address)).toBe(false)
  })
})

describe('donationCurrencyLabel', () => {
  it('знакомая валюта — подпись, незнакомая — как записана', () => {
    expect(donationCurrencyLabel('usdt|trc20')).toBe('USDT (TRC20)')
    expect(donationCurrencyLabel('sol')).toBe('SOL')
  })
})
