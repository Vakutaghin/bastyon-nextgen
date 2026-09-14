// Паритет i18n (аудит, волна 0): каждый строковый ключ, который код передаёт
// в t()/$t()/te(), обязан существовать в обоих словарях, а сами словари —
// иметь одинаковый набор ключей. Ловит «сырой ключ в тосте» (S55) до рантайма.
//
// Динамические ключи (шаблонные строки, переменные) тест не видит — это
// осознанно: они проверяются отдельными тестами своих модулей.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import ru from './ru'
import en from './en'

const SRC = join(__dirname, '..')

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v))
      out.push(...flattenKeys(v as Record<string, unknown>, key))
    else out.push(key)
  }
  return out
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'locales') continue
      walk(p, acc)
    } else if (/\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name) && !/\.d\.ts$/.test(name)) {
      acc.push(p)
    }
  }
  return acc
}

// t('a.b'), $t("a.b"), te('a.b'), i18n.global.t('a.b') — только строковые литералы.
const CALL_RE =
  /(?:^|[^\w$.])\$?(?:i18n\.global\.)?te?\(\s*(['"])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)+)\1/g

function usedKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CALL_RE)) {
      const key = m[2]!
      const list = found.get(key) ?? []
      list.push(relative(SRC, file))
      found.set(key, list)
    }
  }
  return found
}

describe('i18n parity', () => {
  const ruKeys = new Set(flattenKeys(ru as Record<string, unknown>))
  const enKeys = new Set(flattenKeys(en as Record<string, unknown>))

  it('ru и en имеют одинаковый набор ключей', () => {
    const onlyRu = [...ruKeys].filter((k) => !enKeys.has(k))
    const onlyEn = [...enKeys].filter((k) => !ruKeys.has(k))
    expect({ onlyRu, onlyEn }).toEqual({ onlyRu: [], onlyEn: [] })
  })

  it('каждый строковый ключ из кода есть в словаре', () => {
    const missing: string[] = []
    for (const [key, files] of usedKeys()) {
      // Префикс namespace допустим: t('routes') не бывает, но t('a.b') с a.b = объект — ошибка.
      if (!ruKeys.has(key)) missing.push(`${key}  ← ${[...new Set(files)].join(', ')}`)
    }
    expect(missing).toEqual([])
  })
})
