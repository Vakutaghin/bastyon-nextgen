#!/usr/bin/env node
// Миграция inline `:style="{ fontSize: ... }"` биндингов на ant-иконках
// в готовые константы из @/styles/icon-styles. См. CODE_AUDIT.md §3.1.
//
// Обрабатываем только известные шаблоны (icon-styles.ts уже содержит готовые
// варианты). Нестандартные комбинации — оставляем как есть, чтобы не угадывать
// дизайн-намерение.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', 'src')

// Карта: regex по тексту атрибута → имя экспорта из icon-styles.ts.
// Регистрируем только те, что 1-в-1 совпадают с текущими константами в файле.
const MAPPINGS = [
  { pattern: `:style="{ fontSize: '12px' }"`, exportName: 'ICON_SIZE_XS' },
  { pattern: `:style="{ fontSize: '14px' }"`, exportName: 'ICON_SIZE_SM' },
  { pattern: `:style="{ fontSize: '16px' }"`, exportName: 'ICON_SIZE_MD' },
  { pattern: `:style="{ fontSize: '18px' }"`, exportName: 'ICON_SIZE_LG' },
  { pattern: `:style="{ fontSize: '20px' }"`, exportName: 'ICON_SIZE_XL' },
  { pattern: `:style="{ fontSize: '24px' }"`, exportName: 'ICON_SIZE_XXL' },
  {
    pattern: `:style="{ fontSize: '24px', color: 'var(--color-primary)' }"`,
    exportName: 'ICON_PRIMARY_24',
  },
  {
    pattern: `:style="{ fontSize: '40px', color: 'var(--color-primary)' }"`,
    exportName: 'ICON_PRIMARY_40',
  },
  {
    pattern: `:style="{ fontSize: '50px', color: 'var(--color-primary)' }"`,
    exportName: 'ICON_PRIMARY_50',
  },
  {
    pattern: `:style="{ fontSize: '64px', color: 'var(--color-success)', marginBottom: '16px' }"`,
    exportName: 'ICON_SUCCESS_64',
  },
  {
    pattern: `:style="{ color: 'var(--color-success)' }"`,
    exportName: 'ICON_SUCCESS',
  },
  {
    pattern: `:style="{ color: 'var(--color-red-ant)' }"`,
    exportName: 'ICON_DANGER',
  },
  {
    pattern: `:style="{ fontSize: '64px', color: 'var(--color-red-ant)' }"`,
    exportName: 'ICON_DANGER_64',
  },
  {
    pattern: `:style="{ fontSize: '64px', color: 'var(--color-ant-blue)' }"`,
    exportName: 'ICON_ANT_BLUE_64',
  },
  {
    pattern: `:style="{ fontSize: '64px', color: 'var(--color-ant-blue)', marginBottom: '16px' }"`,
    exportName: 'ICON_ANT_BLUE_64_MB',
  },
  {
    pattern: `:style="{ fontSize: '72px', color: 'var(--color-ant-blue)' }"`,
    exportName: 'ICON_ANT_BLUE_72',
  },
  {
    pattern: `:style="{ fontSize: '120px', color: 'var(--color-primary)' }"`,
    exportName: 'ICON_PRIMARY_120',
  },
  {
    pattern: `:style="{ color: 'var(--color-warning)' }"`,
    exportName: 'ICON_WARNING',
  },
  {
    pattern: `:style="{ color: 'var(--color-ant-blue)', marginRight: '4px' }"`,
    exportName: 'ICON_ANT_BLUE_MR_4',
  },
  { pattern: `:style="{ fontSize: '11px' }"`, exportName: 'ICON_SIZE_11' },
  { pattern: `:style="{ fontSize: '13px' }"`, exportName: 'ICON_SIZE_13' },
  {
    pattern: `:style="{ color: 'var(--color-success)', marginRight: '4px' }"`,
    exportName: 'ICON_SUCCESS_MR_4',
  },
  {
    pattern: `:style="{ marginRight: '8px', color: 'var(--color-red-ant)' }"`,
    exportName: 'ICON_DANGER_MR_8',
  },
  {
    pattern: `:style="{ color: 'var(--color-primary)', fontSize: '18px' }"`,
    exportName: 'ICON_PRIMARY_18',
  },
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.vue')) out.push(full)
  }
  return out
}

function ensureImport(src, names) {
  if (names.size === 0) return src
  // Найти существующий импорт из @/styles/icon-styles?
  if (/from\s+['"]@\/styles\/icon-styles['"]/.test(src)) {
    return src.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]@\/styles\/icon-styles['"]/,
      (m, existing) => {
        const list = new Set(existing.split(',').map((s) => s.trim()).filter(Boolean))
        for (const n of names) list.add(n)
        return `import { ${[...list].sort().join(', ')} } from '@/styles/icon-styles'`
      }
    )
  }
  // Найти секцию <script setup ...>
  const scriptMatch = src.match(/<script\s+setup[^>]*>\s*\n/)
  if (!scriptMatch) return src
  const insertAt = scriptMatch.index + scriptMatch[0].length

  // Вставим импорт после последнего существующего import в начале скрипта.
  const after = src.slice(insertAt)
  const importBlockMatch = after.match(/^((?:import\s[^\n]*\n)*)/)
  const importBlockEnd = insertAt + (importBlockMatch ? importBlockMatch[0].length : 0)
  const namesList = [...names].sort().join(', ')
  const stmt = `import { ${namesList} } from '@/styles/icon-styles'\n`
  return src.slice(0, importBlockEnd) + stmt + src.slice(importBlockEnd)
}

let touched = 0
let totalReplacements = 0
for (const file of walk(ROOT)) {
  let src = readFileSync(file, 'utf8')
  if (!/:style="/.test(src)) continue

  const used = new Set()
  let fileReplacements = 0
  for (const { pattern, exportName } of MAPPINGS) {
    const occurrences = src.split(pattern).length - 1
    if (occurrences > 0) {
      src = src.split(pattern).join(`:style="${exportName}"`)
      used.add(exportName)
      fileReplacements += occurrences
    }
  }
  if (used.size === 0) continue

  src = ensureImport(src, used)
  writeFileSync(file, src)
  console.log(`  updated (${fileReplacements}): ${file.slice(ROOT.length + 1)}`)
  touched++
  totalReplacements += fileReplacements
}
console.log(`\n[migrate-icon-styles] ${touched} files, ${totalReplacements} replacements`)
