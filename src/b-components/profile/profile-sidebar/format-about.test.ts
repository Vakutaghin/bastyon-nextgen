import { describe, expect, it } from 'vitest'
import { formatAbout, formatReputation } from './format-about'

describe('formatReputation', () => {
  it('один знак после запятой; число строкой и пустое — тоже', () => {
    expect(formatReputation(345.67)).toBe('345.7')
    expect(formatReputation('12')).toBe('12.0')
    expect(formatReputation(undefined)).toBe('0.0')
    expect(formatReputation('abc')).toBe('0.0')
  })
})

describe('formatAbout', () => {
  it('экранирует разметку и делает ссылки кликабельными', () => {
    expect(formatAbout('<b>горы</b> www.example.org')).toBe(
      '&lt;b&gt;горы&lt;/b&gt; <a href="https://www.example.org" target="_blank" rel="noopener noreferrer">www.example.org</a>'
    )
  })
})
