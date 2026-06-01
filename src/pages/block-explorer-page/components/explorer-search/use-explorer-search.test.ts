import { describe, it, expect } from 'vitest'
import { classifyExplorerQuery, explorerRouteSuggestions } from './use-explorer-search'

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

describe('explorerRouteSuggestions', () => {
  it('maps a block height to a single block route', () => {
    expect(explorerRouteSuggestions('42')).toEqual([
      { kind: 'block', routeName: 'explorer-block', paramKey: 'hashOrHeight', value: '42' },
    ])
  })

  it('maps an address to a single address route', () => {
    const addr = 'PNnWFFuB2uMCxE3YafUm2uLMBw1AiYuYBY'
    expect(explorerRouteSuggestions(addr)).toEqual([
      { kind: 'address', routeName: 'explorer-address', paramKey: 'address', value: addr },
    ])
  })

  it('offers both block and tx for an ambiguous 64-hex hash', () => {
    const hash = '0e8fbe55d706ea5644a4523ae09740316895ce796b66b3de71e93de4c32ef0d4'
    const out = explorerRouteSuggestions(hash.toUpperCase())
    expect(out.map((s) => s.kind)).toEqual(['block', 'tx'])
    expect(out.every((s) => s.value === hash)).toBe(true)
    expect(out[1]).toEqual({
      kind: 'tx',
      routeName: 'explorer-tx',
      paramKey: 'txid',
      value: hash,
    })
  })

  it('returns nothing for unrecognized input', () => {
    expect(explorerRouteSuggestions('hello world')).toEqual([])
    expect(explorerRouteSuggestions('')).toEqual([])
  })
})
