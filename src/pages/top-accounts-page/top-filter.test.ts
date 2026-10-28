import { describe, expect, it } from 'vitest'

import { filterTop, normalizeTopQuery } from './top-filter'

const ENTRIES = [
  { address: 'PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5', reputation: 900 },
  { address: 'PSBePd5Tx5KG9vxwAzbaDTfjzDbq1GUTYw', reputation: 800 },
  { address: 'PMABcFZc7fcgPZzstJrHeYoWXJGoP3pd7X', reputation: 700 },
]
const NAMES: Record<string, string> = {
  PHdW4pwWbFdoofVhSEfPSHgradmrvZdbE5: 'Daniel',
  PSBePd5Tx5KG9vxwAzbaDTfjzDbq1GUTYw: 'Rubezh',
  // У третьего профиль ещё не догружен.
}
const nameOf = (address: string) => NAMES[address]

describe('filterTop', () => {
  it('пустой запрос — весь топ по местам', () => {
    expect(filterTop(ENTRIES, nameOf, '  ').map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('по имени без регистра и с @, место — из полного топа', () => {
    expect(filterTop(ENTRIES, nameOf, '@RUBE')).toEqual([{ entry: ENTRIES[1], rank: 2 }])
  })

  it('по адресу — и у тех, чьё имя ещё не пришло', () => {
    expect(filterTop(ENTRIES, nameOf, 'pmabcf').map((r) => r.rank)).toEqual([3])
  })

  it('ничего не нашлось — пусто', () => {
    expect(filterTop(ENTRIES, nameOf, 'нет такого')).toEqual([])
  })

  it('запрос: пробелы, @ и регистр', () => {
    expect(normalizeTopQuery('  @@Daniel ')).toBe('daniel')
  })
})
