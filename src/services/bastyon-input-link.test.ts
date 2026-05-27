import { describe, it, expect } from 'vitest'
import { parseBastyonInput } from './bastyon-input-link'

describe('parseBastyonInput', () => {
  describe('profile by @name', () => {
    it('parses https URL with /@name', () => {
      expect(parseBastyonInput('https://bastyon.com/@alice')).toEqual({
        kind: 'profile',
        userName: 'alice',
      })
    })

    it('parses pocketnet.app variant', () => {
      expect(parseBastyonInput('https://pocketnet.app/@bob')).toEqual({
        kind: 'profile',
        userName: 'bob',
      })
    })

    it('parses bastyon:// scheme', () => {
      expect(parseBastyonInput('bastyon://@carol')).toEqual({
        kind: 'profile',
        userName: 'carol',
      })
    })

    it('parses host-only short form', () => {
      expect(parseBastyonInput('bastyon.com/@dave')).toEqual({
        kind: 'profile',
        userName: 'dave',
      })
    })

    it('rejects empty @name', () => {
      expect(parseBastyonInput('https://bastyon.com/@')).toBe(null)
    })
  })

  describe('profile by address', () => {
    it('parses /<Pxxx…> as profile', () => {
      const addr = 'PJT7eTrGXD9uCF2QmRmdDJtCBA1R68TRf2'
      expect(parseBastyonInput(`https://bastyon.com/${addr}`)).toEqual({
        kind: 'profile',
        userName: addr,
      })
    })

    it('does not match non-address path', () => {
      expect(parseBastyonInput('https://bastyon.com/random')).toBe(null)
    })
  })

  describe('search via ?ss', () => {
    it('parses /?ss=query', () => {
      expect(parseBastyonInput('https://bastyon.com/?ss=blockchain')).toEqual({
        kind: 'search',
        query: 'blockchain',
        tagMode: false,
      })
    })

    it('parses /?sst=tag1 tag2 as tag search', () => {
      expect(parseBastyonInput('https://bastyon.com/?sst=crypto%20bitcoin')).toEqual({
        kind: 'search',
        query: '#crypto #bitcoin',
        tagMode: true,
      })
    })

    it('keeps hash prefix when already present', () => {
      expect(parseBastyonInput('https://bastyon.com/?sst=%23one+two')).toEqual({
        kind: 'search',
        query: '#one #two',
        tagMode: true,
      })
    })
  })

  describe('not a Bastyon URL', () => {
    it('rejects plain word', () => {
      expect(parseBastyonInput('hello')).toBe(null)
    })

    it('rejects empty / whitespace', () => {
      expect(parseBastyonInput('')).toBe(null)
      expect(parseBastyonInput('   ')).toBe(null)
    })

    it('rejects unrelated host', () => {
      expect(parseBastyonInput('https://example.com/@alice')).toBe(null)
    })

    it('rejects post/index paths (no target route yet)', () => {
      expect(parseBastyonInput('https://bastyon.com/post?s=abc')).toBe(null)
      expect(parseBastyonInput('https://bastyon.com/index?v=abc')).toBe(null)
    })
  })
})
