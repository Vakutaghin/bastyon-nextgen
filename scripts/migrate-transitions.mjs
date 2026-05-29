#!/usr/bin/env node
// Одноразовый скрипт: миграция хардкоженых длительностей в `transition:` объявлениях
// на ${TRANSITIONS.QUICK/FAST/NORMAL/SLOW} из @/styles/design-tokens.
// См. CODE_AUDIT.md §3.4.
//
// Правила маппинга (по близости к существующим токенам):
//   100ms / 0.1s / 120ms / 150ms / 0.15s  → TRANSITIONS.QUICK  (0.15s ease)
//   200ms / 0.2s                          → TRANSITIONS.FAST   (0.2s ease)
//   300ms / 0.3s                          → TRANSITIONS.NORMAL (0.3s ease)
//   500ms / 0.5s                          → TRANSITIONS.SLOW   (0.5s ease)
//
// Сubic-bezier и нестандартные длительности (220ms, 0.22s, 0.24s) — НЕ трогаем,
// у них есть дизайн-намерение.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', 'src')

const DURATION_MAP = [
  { re: /(?<![\d.])100ms\b/g, token: '${TRANSITIONS.QUICK}' },
  { re: /(?<![\d.])120ms\b/g, token: '${TRANSITIONS.QUICK}' },
  { re: /(?<![\d.])150ms\b/g, token: '${TRANSITIONS.QUICK}' },
  { re: /(?<![\d.])200ms\b/g, token: '${TRANSITIONS.FAST}' },
  { re: /(?<![\d.])300ms\b/g, token: '${TRANSITIONS.NORMAL}' },
  { re: /(?<![\d.])500ms\b/g, token: '${TRANSITIONS.SLOW}' },
  { re: /(?<![\d.])0\.1s\b/g, token: '${TRANSITIONS.QUICK}' },
  { re: /(?<![\d.])0\.15s\b/g, token: '${TRANSITIONS.QUICK}' },
  { re: /(?<![\d.])0\.2s\b/g, token: '${TRANSITIONS.FAST}' },
  { re: /(?<![\d.])0\.3s\b/g, token: '${TRANSITIONS.NORMAL}' },
  { re: /(?<![\d.])0\.5s\b/g, token: '${TRANSITIONS.SLOW}' },
]

// Парсит блоки `transition: ...;` (включая многострочные), позволяет заменить
// только внутри них — чтобы не задеть `animation: pulse 1.6s`.
function rewriteTransitions(src) {
  // Простой стейт-машина: ищем `transition:` (с пробелами в начале строки),
  // собираем содержимое до `;`, прогоняем через все DURATION_MAP.re,
  // если token уже использован (`${TRANSITIONS`), пропускаем.
  // Каждое замечание из ease добавляется как есть — TRANSITIONS.QUICK = '0.15s ease',
  // так что `0.15s ease` после замены даёт `${TRANSITIONS.QUICK} ease` — лишнее `ease`.
  // Подчищаем `${TRANSITIONS.X} ease` → `${TRANSITIONS.X}`.
  return src.replace(/(\btransition\s*:\s*)([^;]+);/g, (full, head, body) => {
    if (body.includes('${TRANSITIONS')) return full
    let next = body
    for (const { re, token } of DURATION_MAP) {
      next = next.replace(re, token)
    }
    // Уберём дублирующий ease после подставленного токена
    next = next.replace(/\$\{TRANSITIONS\.(QUICK|FAST|NORMAL|SLOW)\}\s+ease/g, '${TRANSITIONS.$1}')
    return head + next + ';'
  })
}

function ensureImport(src) {
  if (!src.includes('TRANSITIONS')) return src
  // Уже есть импорт?
  if (/from\s+['"]@\/styles\/design-tokens['"]/.test(src)) {
    // Дополнить именованный импорт, если нужно
    return src.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]@\/styles\/design-tokens['"]/,
      (m, names) => {
        const list = names.split(',').map((s) => s.trim()).filter(Boolean)
        if (list.includes('TRANSITIONS')) return m
        return `import { ${[...list, 'TRANSITIONS'].join(', ')} } from '@/styles/design-tokens'`
      }
    )
  }
  // Добавим новую строку импорта после последнего существующего import'а в верхней части файла.
  const lines = src.split('\n')
  let lastImportIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import\b/.test(lines[i])) lastImportIdx = i
    else if (lastImportIdx >= 0 && lines[i].trim() === '') break
  }
  if (lastImportIdx < 0) return src
  lines.splice(
    lastImportIdx + 1,
    0,
    "import { TRANSITIONS } from '@/styles/design-tokens'"
  )
  return lines.join('\n')
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.styled.ts')) out.push(full)
  }
  return out
}

let touched = 0
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  if (!/transition\s*:/.test(src)) continue
  const rewrote = rewriteTransitions(src)
  if (rewrote === src) continue
  const withImport = ensureImport(rewrote)
  if (withImport === src) continue
  writeFileSync(file, withImport)
  touched++
  console.log(`  updated: ${file.slice(ROOT.length + 1)}`)
}
console.log(`\n[migrate-transitions] ${touched} files updated`)
