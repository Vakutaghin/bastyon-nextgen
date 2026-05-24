import { describe, it, expect } from 'vitest'
import { classifyExplorerQuery } from './use-explorer-search'

describe('classifyExplorerQuery', () => {
  it('treats integer as block height', () => {
    expect(classifyExplorerQuery('3845575')).toEqual({ kind: 'block-height', value: '3845575' })
    expect(classifyExplorerQuery('  42 ')).toEqual({ kind: 'block-height', value: '42' })
  })

  it('treats 64 hex chars as hash64 and lowercases', () => {
    const hash = '0e8fbe55d706ea5644a4523ae09740316895ce796b66b3de71e93de4c32ef0d4'
    expect(classifyExplorerQuery(hash.toUpperCase())).toEqual({
      kind: 'hash64',
      value: hash,
    })
  })

  it('treats Pocketnet P-prefixed base58 string as address', () => {
    const addr = 'PNnWFFuB2uMCxE3YafUm2uLMBw1AiYuYBY'
    expect(classifyExplorerQuery(addr)).toEqual({ kind: 'address', value: addr })
  })

  it('returns unknown for empty input', () => {
    expect(classifyExplorerQuery('')).toEqual({ kind: 'unknown', value: '' })
    expect(classifyExplorerQuery('   ')).toEqual({ kind: 'unknown', value: '' })
  })

  it('returns unknown for random strings', () => {
    expect(classifyExplorerQuery('hello world').kind).toBe('unknown')
    expect(classifyExplorerQuery('not-a-hash-or-address').kind).toBe('unknown')
  })

  it('does not classify hex-but-wrong-length as hash64', () => {
    expect(classifyExplorerQuery('0e8fbe55').kind).toBe('unknown')
  })

  it('does not classify too-short P-prefixed string as address', () => {
    expect(classifyExplorerQuery('Pabc').kind).toBe('unknown')
  })
})
