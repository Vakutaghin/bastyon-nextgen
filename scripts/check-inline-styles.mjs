#!/usr/bin/env node
// Inline-style regression guard. See _DOCS/CODE_AUDIT.md §3.1 / §1.
//
// Counts inline style usages in templates:
//   - `:style="..."` in *.vue
//   - plain `style="..."` in *.vue and *.html
//
// Compares totals against scripts/inline-styles-baseline.json.
// Fails (exit 1) if either count grew. New violations must be added
// inside *.styled.ts or via design tokens (src/styles/).
//
// Update baseline after a real cleanup:
//   node scripts/check-inline-styles.mjs --update-baseline

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(__dirname, 'inline-styles-baseline.json')

const SCAN_ROOTS = ['src', 'src-mobile']
const EXTRA_FILES = ['index.html']
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'android', 'ios'])

// :style="{ ... }" / :style="{...}" / :style='{...}' — inline object literal.
// Ссылки на константы или computed (`:style="ICON_PRIMARY_24"`, `:style="frameStyle"`)
// не считаются нарушением — это допустимый шаблон (audit §3.1: icon-styles.ts /
// styled-обёртка).
const VUE_BIND_STYLE = /:style\s*=\s*["'][^"']*\{/g
// Plain HTML style="..." — must NOT be preceded by ':' (which would make it :style)
// and must be a real attribute (preceded by start, space, tab, newline, or quote).
const PLAIN_STYLE = /(^|[\s"'])style\s*=\s*"/g

/** @returns {string[]} */
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
    if (st.isDirectory()) {
      out.push(...walk(full))
    } else if (st.isFile()) {
      out.push(full)
    }
  }
  return out
}

function countMatches(text, regex) {
  // Reset regex state for /g
  regex.lastIndex = 0
  let n = 0
  while (regex.exec(text) !== null) n++
  return n
}

function scan() {
  const files = []
  for (const root of SCAN_ROOTS) {
    files.push(...walk(join(ROOT, root)))
  }
  for (const extra of EXTRA_FILES) {
    files.push(join(ROOT, extra))
  }

  let vueBind = 0
  let plain = 0
  const perFile = []

  for (const file of files) {
    if (!/\.(vue|html)$/.test(file)) continue
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const isVue = file.endsWith('.vue')
    const bindCount = isVue ? countMatches(text, VUE_BIND_STYLE) : 0
    const plainCount = countMatches(text, PLAIN_STYLE)
    if (bindCount + plainCount > 0) {
      perFile.push({
        file: relative(ROOT, file),
        bind: bindCount,
        plain: plainCount,
      })
    }
    vueBind += bindCount
    plain += plainCount
  }

  perFile.sort((a, b) => b.bind + b.plain - (a.bind + a.plain))
  return { vueBind, plain, perFile }
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function writeBaseline(b) {
  writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + '\n')
}

const args = process.argv.slice(2)
const update = args.includes('--update-baseline')
const verbose = args.includes('--verbose')

const result = scan()
const baseline = loadBaseline()

if (update) {
  const next = { vueBind: result.vueBind, plain: result.plain }
  writeBaseline(next)
  console.log(`[inline-styles] baseline updated: vueBind=${next.vueBind} plain=${next.plain}`)
  process.exit(0)
}

if (!baseline) {
  // First run — seed baseline so CI doesn't fail.
  writeBaseline({ vueBind: result.vueBind, plain: result.plain })
  console.log(
    `[inline-styles] baseline created: vueBind=${result.vueBind} plain=${result.plain}`,
  )
  process.exit(0)
}

const grewBind = result.vueBind > baseline.vueBind
const grewPlain = result.plain > baseline.plain

if (grewBind || grewPlain) {
  console.error('[inline-styles] regression detected:')
  if (grewBind) {
    console.error(`  :style="..."  baseline=${baseline.vueBind}  current=${result.vueBind}`)
  }
  if (grewPlain) {
    console.error(`  style="..."   baseline=${baseline.plain}  current=${result.plain}`)
  }
  console.error('')
  console.error('Use *.styled.ts or design tokens (src/styles/) instead of inline styles.')
  console.error('See _DOCS/CODE_AUDIT.md §3.1.')
  console.error('')
  console.error('If you legitimately fixed inline styles (counts went down), run:')
  console.error('  node scripts/check-inline-styles.mjs --update-baseline')
  if (verbose) {
    console.error('\nTop offenders:')
    for (const f of result.perFile.slice(0, 15)) {
      console.error(`  ${f.bind + f.plain}\t${f.file}  (bind=${f.bind} plain=${f.plain})`)
    }
  }
  process.exit(1)
}

if (result.vueBind < baseline.vueBind || result.plain < baseline.plain) {
  console.log(
    `[inline-styles] counts went down — consider updating baseline (vueBind ${baseline.vueBind}→${result.vueBind}, plain ${baseline.plain}→${result.plain})`,
  )
} else {
  console.log(
    `[inline-styles] ok (vueBind=${result.vueBind} plain=${result.plain})`,
  )
}
