// Список antd-legacy-files.json — файлы, которым ESLint ещё разрешает импорт
// ant-design-vue (antd заменяется своими компонентами). Список должен только
// сокращаться и совпадать с кодом: перевёл файл — убери его из списка, иначе
// исключение останется и antd вернётся в этот файл незаметно.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const ANTD_IMPORT = /(?:from\s*|import\s*\(\s*)['"]ant-design-vue(?:\/[^'"]*)?['"]/

const listed: string[] = JSON.parse(readFileSync(join(ROOT, 'antd-legacy-files.json'), 'utf8'))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(p)
    return /\.(vue|ts|tsx|js)$/.test(e.name) ? [p] : []
  })
}

function importsAntd(file: string): boolean {
  return ANTD_IMPORT.test(readFileSync(join(ROOT, file), 'utf8'))
}

describe('antd-legacy-files.json', () => {
  it('каждый файл из списка существует и ещё импортирует antd', () => {
    const stale = listed.filter((f) => !existsSync(join(ROOT, f)) || !importsAntd(f))
    expect(stale).toEqual([])
  })

  it('antd импортируют только файлы из списка', () => {
    const allowed = new Set(listed)
    const extra = ['src', 'src-mobile']
      .flatMap((d) => sourceFiles(join(ROOT, d)))
      .map((f) => relative(ROOT, f).replace(/\\/g, '/'))
      .filter((f) => !allowed.has(f) && importsAntd(f))
    expect(extra).toEqual([])
  })

  it('список отсортирован и без повторов', () => {
    expect(listed).toEqual([...new Set(listed)].sort())
  })
})
