#!/usr/bin/env node
// Breakpoint consistency guard. See _DOCS/CODE_AUDIT.md §3 (CSS / Styled-components).
//
// Single source of truth for breakpoints — BREAKPOINTS in
// src/styles/design-tokens.ts. CSS не умеет читать TS-токены, поэтому
// глобальный style.css держит @media-значения синхронно вручную. Этот гард
// ловит дрейф:
//
//   1) В *.styled.ts любой @media обязан использовать ${BREAKPOINTS.*},
//      а не литеральные пиксели (например `@media (max-width: 768px)`).
//   2) В *.css значения @media должны принадлежать каноническому набору
//      (значения BREAKPOINTS), иначе это рассинхрон с токенами.
//
// Запуск: node scripts/check-breakpoints.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TOKENS_PATH = join(ROOT, 'src/styles/design-tokens.ts')

const SCAN_ROOTS = ['src', 'src-mobile']
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'android', 'ios'])

/** Канонический набор брейкпоинтов из BREAKPOINTS (в px). */
function loadCanonicalPx() {
  const text = readFileSync(TOKENS_PATH, 'utf8')
  const block = text.match(/export const BREAKPOINTS\s*=\s*\{([^}]*)\}/)
  if (!block) {
    console.error('[breakpoints] не найден BREAKPOINTS в design-tokens.ts')
    process.exit(2)
  }
  const px = new Set()
  for (const m of block[1].matchAll(/(\d+)px/g)) px.add(Number(m[1]))
  return px
}

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (st.isFile()) out.push(full)
  }
  return out
}

// @media-запрос до открывающей фигурной скобки (после вырезания комментариев,
// чтобы слово «@media» в комментах style.css не давало ложных срабатываний).
const MEDIA_QUERY = /@media[^{}]*\{/g
const stripBlockComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ')

function scan() {
  const canonical = loadCanonicalPx()
  const files = []
  for (const root of SCAN_ROOTS) files.push(...walk(join(ROOT, root)))

  const violations = []

  for (const file of files) {
    const isStyled = /styled\.ts$/.test(file)
    const isCss = /\.css$/.test(file)
    if (!isStyled && !isCss) continue

    let text
    try {
      text = stripBlockComments(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const rel = relative(ROOT, file)

    for (const m of text.match(MEDIA_QUERY) || []) {
      const pxMatches = [...m.matchAll(/(\d+)px/g)]
      if (!pxMatches.length) continue // использует ${BREAKPOINTS.*} — ок

      if (isStyled) {
        // В styled литеральные px в @media запрещены — только токен.
        violations.push(
          `${rel}: литеральные px в @media — используй \${BREAKPOINTS.*}: "${m.trim()}"`,
        )
      } else {
        for (const px of pxMatches) {
          if (!canonical.has(Number(px[1]))) {
            violations.push(
              `${rel}: брейкпоинт ${px[1]}px вне набора BREAKPOINTS: "${m.trim()}"`,
            )
          }
        }
      }
    }
  }

  return violations
}

const violations = scan()

if (violations.length) {
  console.error('[breakpoints] рассинхрон с токенами BREAKPOINTS:')
  for (const v of violations) console.error('  ' + v)
  console.error('')
  console.error('Источник правды — BREAKPOINTS в src/styles/design-tokens.ts.')
  console.error('См. _DOCS/CODE_AUDIT.md §3.')
  process.exit(1)
}

console.log('[breakpoints] ok (все @media согласованы с BREAKPOINTS)')
