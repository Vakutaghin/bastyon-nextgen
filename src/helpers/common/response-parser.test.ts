import { describe, it, expect } from 'vitest'
import { unwrapRpcResponse, unwrapRpcArray } from './response-parser'

describe('unwrapRpcResponse', () => {
  it('returns null for null/undefined', () => {
    expect(unwrapRpcResponse(null)).toBeNull()
    expect(unwrapRpcResponse(undefined)).toBeNull()
  })

  it('returns array as-is', () => {
    const arr = [1, 2, 3]
    expect(unwrapRpcResponse(arr)).toBe(arr)
  })

  it('unwraps { result: "success", data: T }', () => {
    const data = { foo: 'bar' }
    expect(unwrapRpcResponse({ result: 'success', data })).toBe(data)
  })

  it('unwraps { data: T }', () => {
    const data = { foo: 'bar' }
    expect(unwrapRpcResponse({ data })).toBe(data)
  })

  it('returns primitive as-is', () => {
    expect(unwrapRpcResponse(42)).toBe(42)
    expect(unwrapRpcResponse('hello')).toBe('hello')
  })

  it('prefers result+data over data alone', () => {
    const data = { inner: true }
    const response = { result: 'success', data }
    expect(unwrapRpcResponse(response)).toBe(data)
  })

  it('unwraps data when result is not success', () => {
    const data = { foo: 'bar' }
    expect(unwrapRpcResponse({ result: 'error', data })).toBe(data)
  })
})

describe('unwrapRpcArray', () => {
  it('returns array from array response', () => {
    const arr = [1, 2]
    expect(unwrapRpcArray(arr)).toBe(arr)
  })

  it('returns array from { data: [...] }', () => {
    const arr = [1, 2]
    expect(unwrapRpcArray({ data: arr })).toBe(arr)
  })

  it('returns empty array for null', () => {
    expect(unwrapRpcArray(null)).toEqual([])
  })

  it('returns empty array for non-array data', () => {
    expect(unwrapRpcArray({ data: 'string' })).toEqual([])
  })

  it('returns empty array for object without data', () => {
    expect(unwrapRpcArray({ foo: 'bar' })).toEqual([])
  })
})
