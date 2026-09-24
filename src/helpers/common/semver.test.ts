import { describe, it, expect } from 'vitest'
import { compareSemver, isNewerVersion, normalizeVersion } from './semver'

describe('normalizeVersion', () => {
  it('срезает префикс тега и суффикс предрелиза', () => {
    expect(normalizeVersion('v0.3.0')).toBe('0.3.0')
    expect(normalizeVersion('0.3.0')).toBe('0.3.0')
    expect(normalizeVersion('v1.2.3-beta.1')).toBe('1.2.3')
    expect(normalizeVersion('  v2.0 ')).toBe('2.0')
  })

  it('возвращает null, если чисел нет', () => {
    expect(normalizeVersion('latest')).toBeNull()
    expect(normalizeVersion('')).toBeNull()
  })
})

describe('compareSemver', () => {
  it('сравнивает по компонентам', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0)
    expect(compareSemver('1.3.0', '1.2.9')).toBeGreaterThan(0)
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
  })

  it('добивает недостающие компоненты нулями', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('1.2', '1.2.1')).toBeLessThan(0)
    expect(compareSemver('2', '1.9.9')).toBeGreaterThan(0)
  })

  it('не сравнивает как строки', () => {
    // "10" < "9" лексикографически, но 10 > 9 численно.
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0)
  })
})

describe('isNewerVersion', () => {
  it('принимает теги с префиксом v', () => {
    expect(isNewerVersion('v0.3.0', '0.2.0')).toBe(true)
    expect(isNewerVersion('v0.2.0', '0.2.0')).toBe(false)
    expect(isNewerVersion('v0.1.0', '0.2.0')).toBe(false)
  })

  it('на мусорном входе не обещает обновления', () => {
    expect(isNewerVersion('nightly', '0.2.0')).toBe(false)
    expect(isNewerVersion('v0.3.0', 'dev')).toBe(false)
  })
})
