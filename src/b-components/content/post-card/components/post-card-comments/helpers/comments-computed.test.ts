// Порядок обсуждения не скачет: показанные комментарии держат места, новые
// встают по сортировке, комментарий из превью после раскрытия — первым.

import { describe, expect, it } from 'vitest'

import { stabilizeOrder } from './comments-computed'

describe('stabilizeOrder', () => {
  it('первый раз — порядок сортировки, комментарий из превью первым', () => {
    expect(stabilizeOrder(null, ['b', 'a', 'c'])).toEqual(['b', 'a', 'c'])
    expect(stabilizeOrder(null, ['b', 'a', 'c'], 'c')).toEqual(['c', 'b', 'a'])
    // Комментария из превью в списке нет (ответ в ветке) — просто сортировка.
    expect(stabilizeOrder([], ['b', 'a'], 'zz')).toEqual(['b', 'a'])
  })

  it('пересортировка после оценок не двигает показанные', () => {
    // «Интересные»: после лайка c поднялся бы на первое место.
    expect(stabilizeOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('новые встают туда, куда их ставит сортировка; удалённые уходят', () => {
    // «Сначала новые»: свежий n — наверх, остальные на своих местах.
    expect(stabilizeOrder(['a', 'b', 'c'], ['n', 'c', 'b', 'a'])).toEqual(['n', 'a', 'b', 'c'])
    expect(stabilizeOrder(['a', 'b', 'c'], ['b', 'a'])).toEqual(['a', 'b'])
    expect(stabilizeOrder(['a', 'b'], ['b', 'x', 'a', 'y'])).toEqual(['a', 'x', 'b', 'y'])
  })
})
