import { describe, it, expect } from 'vitest'
import ru from './ru'
import en from './en'

// Собирает все «листовые» пути ключей словаря (домен.под.ключ).
function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectKeyPaths(value as Record<string, unknown>, path))
    } else {
      paths.push(path)
    }
  }
  return paths.sort()
}

describe('симметрия словарей ru/en', () => {
  const ruKeys = collectKeyPaths(ru)
  const enKeys = collectKeyPaths(en)

  it('наборы ключей идентичны (нет пропущенных переводов)', () => {
    const ruSet = new Set(ruKeys)
    const enSet = new Set(enKeys)
    const missingInEn = ruKeys.filter((k) => !enSet.has(k))
    const missingInRu = enKeys.filter((k) => !ruSet.has(k))

    expect(missingInEn, `ключи есть в ru, но нет в en: ${missingInEn.join(', ')}`).toEqual([])
    expect(missingInRu, `ключи есть в en, но нет в ru: ${missingInRu.join(', ')}`).toEqual([])
  })

  it('нет пустых строк-значений', () => {
    const emptyRu = ruKeys.filter((k) => {
      const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)?.[part], ru)
      return typeof v === 'string' && v.trim() === ''
    })
    expect(emptyRu).toEqual([])
  })

  it('интерполяционные плейсхолдеры совпадают между ru и en', () => {
    const placeholders = (s: string) => (s.match(/\{[^}]+\}/g) || []).sort()
    const get = (dict: unknown, path: string) =>
      path.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], dict)

    for (const key of ruKeys) {
      const ruVal = get(ru, key)
      const enVal = get(en, key)
      if (typeof ruVal === 'string' && typeof enVal === 'string') {
        expect(placeholders(enVal), `плейсхолдеры расходятся в ключе ${key}`).toEqual(
          placeholders(ruVal)
        )
      }
    }
  })
})
