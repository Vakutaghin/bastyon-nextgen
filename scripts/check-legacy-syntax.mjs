#!/usr/bin/env node
/**
 * Проверка бандла после `vite build`: нет ли в JS того, что esbuild не понижает
 * под OLDEST_ENGINES из vite.config.js (Safari 15, Chromium 89).
 *
 * Синтаксис esbuild понижает сам, но регулярные выражения — нет: неподдерживаемый
 * литерал он превращает в `new RegExp(...)`, и тот падает уже при запуске.
 * Lookbehind `(?<=…)`/`(?<!…)` Safari понимает только с 16.4 — такой литерал в
 * главном чанке (тайм-коды) не давал приложению запуститься на macOS 10.15.
 * Флаг `v` — Safari 17, Chromium 112.
 *
 * Запуск: node scripts/check-legacy-syntax.mjs [папка сборки, по умолчанию dist]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] || 'dist'

/** Что ищем: текст шаблона в коде чанка и почему он не годится. */
const RULES = [
  { re: /\(\?<[=!]/g, why: 'lookbehind в регулярном выражении (Safari 16.4+)' },
  {
    re: /new RegExp\([^()]*,\s*["'`][dgimsuy]*v[dgimsuy]*["'`]\)/g,
    why: 'флаг v регулярного выражения (Safari 17+, Chromium 112+)',
  },
]

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* jsFiles(path)
    else if (name.endsWith('.js') || name.endsWith('.mjs')) yield path
  }
}

const problems = []
for (const file of jsFiles(root)) {
  const code = readFileSync(file, 'utf8')
  for (const { re, why } of RULES) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(code)) !== null) {
      const at = m.index
      const context = code.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ')
      problems.push(`${relative(process.cwd(), file)}: ${why}\n    …${context}…`)
    }
  }
}

if (problems.length) {
  console.error(
    `Бандл не запустится на самых старых поддерживаемых движках (Safari 15, Chromium 89):\n\n` +
      problems.join('\n\n') +
      `\n\nПерепишите выражение без этого синтаксиса (пример — nextTimecode в src/helpers/content/timecode-parser.ts).`
  )
  process.exit(1)
}
console.log(`check-legacy-syntax: ${root} годится для Safari 15 и Chromium 89`)
