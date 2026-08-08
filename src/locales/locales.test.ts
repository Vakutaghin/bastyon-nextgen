import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
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

// Каждое сообщение vue-i18n компилирует лениво при первом обращении (legacy:false,
// рантайм-компиляция). Невалидный синтаксис (например, голый `@` — это linked-формат
// vue-i18n) роняет рендер уже в проде, а не на сборке. Прогоняем каждую строку через
// настоящий t() того же рантайма, чтобы ловить такие строки тестом, а не в консоли.
describe('все сообщения компилируются vue-i18n', () => {
  const get = (dict: unknown, path: string) =>
    path.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], dict)

  for (const [name, dict] of [
    ['ru', ru],
    ['en', en],
  ] as const) {
    it(`${name}: нет строк с невалидным синтаксисом сообщений`, () => {
      const i18n = createI18n({ legacy: false, locale: name, messages: { [name]: dict } })
      const t = i18n.global.t as (key: string) => string

      const broken: string[] = []
      for (const key of collectKeyPaths(dict)) {
        const val = get(dict, key)
        if (typeof val !== 'string') continue
        try {
          t(key)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          broken.push(`${key}: ${JSON.stringify(val)} → ${msg}`)
        }
      }
      expect(broken, `сломанные сообщения:\n${broken.join('\n')}`).toEqual([])
    })
  }
})
