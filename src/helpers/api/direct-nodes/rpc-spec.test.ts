// Параметры для ноды приводятся так же, как это делает прокси (proxy16
// node/rpc.js): нода сама проверяет типы и число вместо строки отклонит.

import { describe, expect, it } from 'vitest'
import { coerceParams, nodePath, POST_METHODS, PUBLIC_METHODS } from './rpc-spec'

describe('coerceParams', () => {
  it('строки, числа, флаги и объекты — по таблице прокси', () => {
    // getrawtransaction: 'str int'
    expect(coerceParams('getrawtransaction', ['ab', '1'])).toEqual(['ab', 1])
    // txunspent: 'obj int int' — адреса строкой JSON тоже годятся
    expect(coerceParams('txunspent', ['["PAddr"]', '1', 9999999])).toEqual([['PAddr'], 1, 9999999])
    // getuserprofile: 'obj' — второй параметр без типа уходит как есть
    expect(coerceParams('getuserprofile', [['PAddr'], '1'])).toEqual([['PAddr'], '1'])
  })

  it('пустые значения — по умолчанию, как у прокси', () => {
    expect(coerceParams('getrawtransaction', [null, undefined])).toEqual(['', 0])
    expect(coerceParams('txunspent', ['not json'])).toEqual([''])
  })

  it('параметры объектом (getapps) — в массив, как у прокси', () => {
    expect(coerceParams('getapps', { search: 'x', pageSize: 10 })).toEqual([
      { search: 'x', pageSize: 10 },
    ])
    expect(coerceParams('getnodeinfo', undefined)).toEqual([])
  })

  it('метод без таблицы — параметры как есть', () => {
    expect(coerceParams('getnosuchthing', [1, 'a'])).toEqual([1, 'a'])
  })
})

describe('nodePath', () => {
  it('транзакции — на /post/, остальное — на /public/', () => {
    expect(nodePath('sendrawtransactionwithmessage')).toBe('/post/')
    expect(nodePath('getnodeinfo')).toBe('/public/')
    expect(POST_METHODS.has('sendrawtransaction')).toBe(true)
    expect(PUBLIC_METHODS.has('gethierarchicalstrip')).toBe(true)
  })
})
