#!/usr/bin/env node
// Гейт тайпчека «не хуже baseline» (аудит N28 / волна 0).
//
// vue-tsc проверяет .ts и .vue целиком, но в проекте ~1400 исторических
// ошибок (в основном TS2345 в *.styled.ts из-за типов vue3-styled-components).
// Чинить их разом нельзя, а пускать новые — тоже. Поэтому:
//   - typecheck-baseline.json хранит число ошибок, которое сейчас считается нормой;
//   - гард падает, если ошибок стало БОЛЬШЕ;
//   - если стало меньше — просит опустить планку (`--update` записывает новое число).
//
// Запуск: node scripts/check-typecheck-baseline.mjs [--update]

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'typecheck-baseline.json')
const update = process.argv.includes('--update')

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vue-tsc.cmd' : 'vue-tsc')
// vue-tsc на всём проекте берёт больше 2 ГБ. На машине с 8 ГБ памяти Node по
// умолчанию даёт куче около 2 ГБ, и vue-tsc падает с heap out of memory.
const nodeOptions = process.env.NODE_OPTIONS || ''
const env = /--max-old-space-size/.test(nodeOptions)
  ? process.env
  : { ...process.env, NODE_OPTIONS: `${nodeOptions} --max-old-space-size=4096`.trim() }
const run = spawnSync(bin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: root, encoding: 'utf8', env, shell: process.platform === 'win32' })
const output = `${run.stdout || ''}${run.stderr || ''}`
const errors = output.split(/\r?\n/).filter((line) => /error TS\d+:/.test(line))
const count = errors.length

if (run.error) {
  console.error(`[typecheck] vue-tsc не запустился: ${run.error.message}`)
  process.exit(1)
}

// vue-tsc выходит с 0 без ошибок и с 2, если нашёл ошибки типов. Ненулевой код
// без единой ошибки TS значит, что он упал, не досчитав. Раньше гейт принимал
// это за «0 ошибок» и пропускал push.
if (run.status !== 0 && count === 0) {
  console.error(`[typecheck] vue-tsc упал (код ${run.status ?? run.signal}), ошибки не посчитаны:`)
  console.error(output.trim().split(/\r?\n/).slice(-15).join('\n'))
  process.exit(1)
}

if (update) {
  writeFileSync(baselinePath, `${JSON.stringify({ ...baseline, errors: count }, null, 2)}\n`)
  console.log(`[typecheck] baseline обновлён: ${baseline.errors} → ${count}`)
  process.exit(0)
}

if (count > baseline.errors) {
  const known = new Set((baseline.known || []).map((s) => s))
  console.error(`[typecheck] ошибок ${count}, baseline ${baseline.errors} — появились новые:`)
  // Показываем только строки вне styled-шума, чтобы было видно, что именно добавилось.
  errors.filter((e) => !/styled\.ts\(/.test(e) && !known.has(e)).slice(0, 40).forEach((e) => console.error('  ' + e))
  process.exit(1)
}

if (count < baseline.errors) {
  console.log(`[typecheck] ok: ${count} ошибок (< baseline ${baseline.errors}) — опусти планку: node scripts/check-typecheck-baseline.mjs --update`)
} else {
  console.log(`[typecheck] ok: ${count} ошибок (= baseline)`)
}
