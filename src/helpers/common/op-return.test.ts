import { describe, expect, it } from 'vitest'
import { MAX_OP_RETURN_BYTES, fitOpReturnText, opReturnText, utf8Length } from './op-return'

describe('op-return', () => {
  it('текст из OP_RETURN читается как у старого клиента', () => {
    const hex = '6a08' + Buffer.from('a:donate').toString('hex')
    expect(opReturnText(hex)).toBe('a:donate')
    expect(opReturnText('76a914')).toBeUndefined()
  })

  it('сообщение укорачивается по байтам UTF-8, а не по буквам', () => {
    expect(fitOpReturnText('a'.repeat(100))).toBe('a'.repeat(MAX_OP_RETURN_BYTES))
    expect(fitOpReturnText('щ'.repeat(60))).toBe('щ'.repeat(40))
    // Символ не режется пополам: смайлик — 4 байта, на 3 оставшихся не влезает.
    const fitted = fitOpReturnText('a'.repeat(77) + '😀')
    expect(fitted).toBe('a'.repeat(77))
    expect(utf8Length(fitted)).toBeLessThanOrEqual(MAX_OP_RETURN_BYTES)
    expect(fitOpReturnText('За кофе')).toBe('За кофе')
  })
})
