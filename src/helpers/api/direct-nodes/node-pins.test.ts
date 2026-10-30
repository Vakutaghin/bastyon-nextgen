// Сертификаты нод запоминаются при первой встрече и не перезаписываются; через
// 400 дней запись забывается — сертификат нода выпускает на год.

import { beforeEach, describe, expect, it } from 'vitest'
import { pinOf, rememberPin, resetPinsForTests } from './node-pins'

describe('node pins', () => {
  beforeEach(() => resetPinsForTests())

  it('первый отпечаток остаётся, второй не перезаписывает', () => {
    expect(pinOf('1.2.3.4:38881')).toBeNull()
    rememberPin('1.2.3.4:38881', 'AA')
    rememberPin('1.2.3.4:38881', 'bb')
    expect(pinOf('1.2.3.4:38881')).toBe('aa')
    // У WSS той же ноды сертификат свой.
    expect(pinOf('1.2.3.4:8887')).toBeNull()
  })

  it('устаревшая запись забывается', () => {
    const t0 = Date.UTC(2026, 0, 1)
    rememberPin('1.2.3.4:38881', 'aa', t0)
    const later = t0 + 401 * 24 * 3600 * 1000
    expect(pinOf('1.2.3.4:38881', later)).toBeNull()
    rememberPin('1.2.3.4:38881', 'bb', later)
    expect(pinOf('1.2.3.4:38881', later)).toBe('bb')
  })
})
