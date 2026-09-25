import { describe, it, expect } from 'vitest'
import { compactBlockParams } from './use-block-explorer-queries'

describe('compactBlockParams', () => {
  it('высота уходит вторым параметром числом — иначе нода ищет её как хеш', () => {
    // Живая проба: ["1", -1] → «Block not found», ["", 1] → блок №1.
    expect(compactBlockParams('1')).toEqual(['', 1])
    expect(compactBlockParams('3500000')).toEqual(['', 3500000])
  })

  it('хеш уходит первым параметром', () => {
    const hash = '00000d2107354549b8143ca4ebd51364c122aad142a8e910cbd73a579e48a2c0'
    expect(compactBlockParams(hash)).toEqual([hash, -1])
  })
})
