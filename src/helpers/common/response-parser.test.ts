import { describe, it, expect } from 'vitest'
import { unwrapRpcResponse, unwrapRpcArray } from './response-parser'

// ---------------------------------------------------------------------------
// unwrapRpcResponse
// ---------------------------------------------------------------------------

describe('unwrapRpcResponse', () => {
  // ── null / undefined ─────────────────────────────────────────────────

  describe('null and undefined inputs', () => {
    it('returns null for null', () => {
      expect(unwrapRpcResponse(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(unwrapRpcResponse(undefined)).toBeNull()
    })
  })

  // ── Direct array ────────────────────────────────────────────────────

  describe('direct array responses', () => {
    it('returns array as-is', () => {
      const arr = [1, 2, 3]
      expect(unwrapRpcResponse(arr)).toBe(arr)
    })

    it('returns empty array as-is', () => {
      const result = unwrapRpcResponse<string[]>([])
      expect(result).toEqual([])
    })

    it('preserves array reference', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      const result = unwrapRpcResponse(arr)
      expect(result).toBe(arr)
    })
  })

  // ── { result: 'success', data: T } format ──────────────────────────

  describe('{ result: "success", data: T } format', () => {
    it('unwraps { result: "success", data: T }', () => {
      const data = { foo: 'bar' }
      expect(unwrapRpcResponse({ result: 'success', data })).toBe(data)
    })

    it('unwraps array data from success envelope', () => {
      const response = { result: 'success', data: [1, 2, 3] }
      expect(unwrapRpcResponse<number[]>(response)).toEqual([1, 2, 3])
    })

    it('unwraps null data from success envelope', () => {
      const response = { result: 'success', data: null }
      expect(unwrapRpcResponse(response)).toBeNull()
    })

    it('unwraps falsy values (0, false, empty string) from success envelope', () => {
      expect(unwrapRpcResponse({ result: 'success', data: 0 })).toBe(0)
      expect(unwrapRpcResponse({ result: 'success', data: false })).toBe(false)
      expect(unwrapRpcResponse({ result: 'success', data: '' })).toBe('')
    })

    it('prefers result+data over data alone', () => {
      const data = { inner: true }
      const response = { result: 'success', data }
      expect(unwrapRpcResponse(response)).toBe(data)
    })
  })

  // ── { data: T } format (no result field) ───────────────────────────

  describe('{ data: T } format', () => {
    it('unwraps { data: T }', () => {
      const data = { foo: 'bar' }
      expect(unwrapRpcResponse({ data })).toBe(data)
    })

    it('unwraps null data', () => {
      expect(unwrapRpcResponse({ data: null })).toBeNull()
    })

    it('unwraps array data', () => {
      const response = { data: ['a', 'b', 'c'] }
      expect(unwrapRpcResponse<string[]>(response)).toEqual(['a', 'b', 'c'])
    })
  })

  // ── { result: 'error', data: ... } format ─────────────────────────

  describe('error result format', () => {
    it('unwraps data when result is not success (falls through to data check)', () => {
      const data = { foo: 'bar' }
      expect(unwrapRpcResponse({ result: 'error', data })).toBe(data)
    })

    it('returns whole object when result is error and no data field', () => {
      const response = { result: 'error', error: 'not found' }
      // No 'data' key, so returned as-is
      expect(unwrapRpcResponse(response)).toBe(response)
    })
  })

  // ── Direct primitive / object ──────────────────────────────────────

  describe('direct values (passthrough)', () => {
    it('returns primitive as-is', () => {
      expect(unwrapRpcResponse(42)).toBe(42)
      expect(unwrapRpcResponse('hello')).toBe('hello')
    })

    it('returns boolean as-is', () => {
      expect(unwrapRpcResponse(true)).toBe(true)
      expect(unwrapRpcResponse(false)).toBe(false)
    })

    it('returns zero as-is', () => {
      expect(unwrapRpcResponse(0)).toBe(0)
    })

    it('returns empty string as-is', () => {
      expect(unwrapRpcResponse('')).toBe('')
    })

    it('returns plain object without data/result as-is', () => {
      const obj = { foo: 'bar', baz: 123 }
      expect(unwrapRpcResponse(obj)).toBe(obj)
    })
  })

  // ── Objects with extra metadata fields ─────────────────────────────

  describe('objects with extra metadata', () => {
    it('unwraps data even with node/time metadata', () => {
      const response = {
        result: 'success',
        data: [{ address: 'P1' }],
        node: '1.2.3.4:8080',
        time: { preparing: 1, cache: 2, start: 3, ready: 4 },
      }
      expect(unwrapRpcResponse(response)).toEqual([{ address: 'P1' }])
    })

    it('unwraps data with undefined error field when result is success', () => {
      const response = {
        result: 'success',
        data: { value: 99 },
        error: undefined,
      }
      expect(unwrapRpcResponse(response)).toEqual({ value: 99 })
    })
  })

  // ── Nested / double wrappers ───────────────────────────────────────

  describe('nested wrappers', () => {
    it('only unwraps one level of { data: ... }', () => {
      const response = { data: { data: 'inner' } }
      // unwrapRpcResponse peels a single layer
      expect(unwrapRpcResponse(response)).toEqual({ data: 'inner' })
    })

    it('only unwraps one level of { result: "success", data: { data: ... } }', () => {
      const response = { result: 'success', data: { data: 'nested' } }
      expect(unwrapRpcResponse(response)).toEqual({ data: 'nested' })
    })
  })

  // ── Type inference ─────────────────────────────────────────────────

  describe('type parameterization', () => {
    it('narrows the type via generic parameter', () => {
      interface UserProfile {
        address: string
        name: string
      }
      const response = { result: 'success', data: { address: 'P1', name: 'Alice' } }
      const result = unwrapRpcResponse<UserProfile>(response)
      expect(result).not.toBeNull()
      expect(result!.address).toBe('P1')
      expect(result!.name).toBe('Alice')
    })
  })
})

// ---------------------------------------------------------------------------
// unwrapRpcArray
// ---------------------------------------------------------------------------

describe('unwrapRpcArray', () => {
  describe('null and undefined', () => {
    it('returns empty array for null', () => {
      expect(unwrapRpcArray(null)).toEqual([])
    })

    it('returns empty array for undefined', () => {
      expect(unwrapRpcArray(undefined)).toEqual([])
    })
  })

  describe('direct array', () => {
    it('returns array from array response', () => {
      const arr = [1, 2]
      expect(unwrapRpcArray(arr)).toBe(arr)
    })

    it('returns empty array as-is', () => {
      expect(unwrapRpcArray([])).toEqual([])
    })
  })

  describe('wrapped in { data: T[] }', () => {
    it('returns array from { data: [...] }', () => {
      const arr = [1, 2]
      expect(unwrapRpcArray({ data: arr })).toBe(arr)
    })

    it('returns empty array from { data: [] }', () => {
      expect(unwrapRpcArray({ data: [] })).toEqual([])
    })
  })

  describe('wrapped in { result: "success", data: T[] }', () => {
    it('unwraps array from success envelope', () => {
      const response = { result: 'success', data: ['a', 'b'] }
      expect(unwrapRpcArray<string>(response)).toEqual(['a', 'b'])
    })
  })

  describe('non-array data', () => {
    it('returns empty array for non-array data', () => {
      expect(unwrapRpcArray({ data: 'string' })).toEqual([])
    })

    it('returns empty array for object without data', () => {
      expect(unwrapRpcArray({ foo: 'bar' })).toEqual([])
    })

    it('returns empty array when unwrapped data is a number', () => {
      expect(unwrapRpcArray(42)).toEqual([])
    })

    it('returns empty array when data is null inside wrapper', () => {
      expect(unwrapRpcArray({ data: null })).toEqual([])
    })

    it('returns empty array for object data (not array)', () => {
      expect(unwrapRpcArray({ data: { notAnArray: true } })).toEqual([])
    })
  })

  describe('real-world RPC response shapes', () => {
    it('handles a typical getuserprofile response', () => {
      const response = {
        result: 'success',
        data: [
          { address: 'P1', name: 'Alice', i: 'https://img/1.png' },
          { address: 'P2', name: 'Bob', i: 'https://img/2.png' },
        ],
        node: '10.0.0.1:38081',
        time: { preparing: 0, cache: 0, start: 100, ready: 150 },
      }
      const result = unwrapRpcArray<{ address: string; name: string }>(response)
      expect(result).toHaveLength(2)
      expect(result[0].address).toBe('P1')
      expect(result[1].name).toBe('Bob')
    })

    it('handles an empty success response', () => {
      expect(unwrapRpcArray({ result: 'success', data: [] })).toEqual([])
    })

    it('handles response with only error (no data field)', () => {
      const response = { result: 'error', error: 'not found' }
      // No 'data' key => unwrapRpcResponse returns the whole object,
      // which is not an array => unwrapRpcArray returns []
      expect(unwrapRpcArray(response)).toEqual([])
    })
  })
})
