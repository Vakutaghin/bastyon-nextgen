import { describe, expect, it } from 'vitest'
import { nextAddressTxCursor } from './address-tx-cursor'

const PAGE = 25

// S66: курсор `minHeight - 1` перепрыгивал остаток блока на границе страницы.
describe('nextAddressTxCursor', () => {
  it('курсор включает граничный блок, чтобы не терять его хвост', () => {
    const heights = Array.from({ length: PAGE }, (_, i) => 1000 - i)
    expect(
      nextAddressTxCursor({ heights, freshCount: PAGE, currentCursor: -1, pageSize: PAGE })
    ).toEqual({ nextCursor: 976, hasMore: true })
  })

  it('страница целиком из дублей — шагаем на блок ниже', () => {
    const heights = new Array(PAGE).fill(500)
    expect(
      nextAddressTxCursor({ heights, freshCount: 0, currentCursor: 500, pageSize: PAGE })
    ).toEqual({ nextCursor: 499, hasMore: true })
  })

  it('неполная страница означает конец истории', () => {
    expect(
      nextAddressTxCursor({ heights: [900, 899], freshCount: 2, currentCursor: -1, pageSize: PAGE })
    ).toEqual({ nextCursor: 899, hasMore: false })
  })

  it('пустая страница — конец', () => {
    expect(
      nextAddressTxCursor({ heights: [], freshCount: 0, currentCursor: 700, pageSize: PAGE })
    ).toEqual({ nextCursor: 700, hasMore: false })
  })

  it('высота 0 или мусор — останавливаемся, а не зацикливаемся', () => {
    expect(
      nextAddressTxCursor({ heights: [0, 5], freshCount: 1, currentCursor: 10, pageSize: PAGE })
    ).toEqual({ nextCursor: 10, hasMore: false })
  })

  it('курсор не повторяется — иначе «Загрузить ещё» топчется на месте', () => {
    const heights = new Array(PAGE).fill(300)
    const result = nextAddressTxCursor({
      heights,
      freshCount: PAGE,
      currentCursor: 300,
      pageSize: PAGE,
    })
    expect(result).toEqual({ nextCursor: 300, hasMore: false })
  })
})
