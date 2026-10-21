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
 * Исключение — чанк узла IPFS (src/helpers/ipfs/ipfs-node.ts, Helia): его грузит
 * только динамический import() при открытии IPFS-ссылки, и сбой загрузки на
 * старом движке ловится — окно предлагает открыть ссылку в браузере
 * (ipfs-node-loader.ts). Lookbehind там — из библиотеки ip-regex.
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

/** Чанки, которые грузятся лениво и переживают сбой загрузки (см. шапку). */
const LAZY_MODERN_CHUNK = /(^|[\\/])ipfs-node-[\w-]{8}\.js$/

const problems = []
for (const file of jsFiles(root)) {
  if (LAZY_MODERN_CHUNK.test(file)) continue
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
