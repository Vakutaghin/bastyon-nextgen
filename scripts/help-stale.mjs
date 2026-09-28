#!/usr/bin/env node
// Какие статьи справки могли устареть: код из их `code:` (шапка русской
// статьи, help/ru/*.md) менялся в git позже, чем сама статья. Это список
// «что перечитать и обновить», а не проверка: скрипт всегда выходит с 0.
// Черновики (`draft: true`) не сверяются — скрипт только перечисляет их.
//
//   pnpm help:stale
//
// Правила справки — help/README.md.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRIMARY = join(ROOT, 'help', 'ru')
const LOCALES = ['ru', 'en']
const MAX_COMMITS = 5

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

/** `code:` из шапки: список в строку `[a, b]` или столбиком `  - a`. */
function codePaths(source) {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? ''
  const lines = head.split(/\r?\n/)
  const at = lines.findIndex((l) => /^code:/.test(l))
  if (at < 0) return []
  const inline = /^code:\s*\[(.*)\]\s*(#.*)?$/.exec(lines[at])
  const items = inline
    ? inline[1].split(',')
    : lines
        .slice(at + 1)
        .filter((l, i, all) => all.slice(0, i + 1).every((x) => /^\s+-\s+/.test(x)))
        .map((l) => l.replace(/^\s+-\s+/, ''))
  return items.map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

/** `draft: true` в шапке — статья ещё пишется. */
function isDraft(source) {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? ''
  return /^draft:\s*true\s*(#.*)?$/m.test(head)
}

function lastCommit(paths) {
  const out = git('log', '-1', '--format=%ct', '--', ...paths)
  return out ? Number(out) : 0
}

const topics = readdirSync(PRIMARY)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.slice(0, -3))
  .sort()

const stale = []
const unbound = []
const drafts = []
for (const id of topics) {
  const source = readFileSync(join(PRIMARY, `${id}.md`), 'utf8')
  if (isDraft(source)) {
    drafts.push(id)
    continue
  }
  const code = codePaths(source)
  if (!code.length) {
    unbound.push(id)
    continue
  }
  const missing = code.filter((p) => !existsSync(join(ROOT, p)))
  const articleFiles = LOCALES.map((l) => `help/${l}/${id}.md`).filter((p) => existsSync(join(ROOT, p)))
  const articleTime = lastCommit(articleFiles)
  // Статью пишут прямо сейчас (новая или правится) — сверять пока не с чем.
  if (!articleTime || git('status', '--porcelain', '--', ...articleFiles)) continue
  const existing = code.filter((p) => !missing.includes(p))
  const codeTime = existing.length ? lastCommit(existing) : 0
  const dirty = existing.length ? git('status', '--porcelain', '--', ...existing) : ''
  if (codeTime > articleTime || dirty || missing.length) {
    const commits = git('log', `--since=${articleTime + 1}`, '--format=%h %ad %s', '--date=short', '--', ...existing)
    stale.push({ id, commits: commits ? commits.split('\n') : [], dirty: !!dirty, missing })
  }
}

if (!stale.length) {
  console.log(`[help:stale] статей с кодом: ${topics.length - unbound.length - drafts.length}, все новее своего кода`)
} else {
  console.log(`[help:stale] могли устареть (${stale.length}):`)
  for (const { id, commits, dirty, missing } of stale) {
    console.log(`\n  help/ru/${id}.md`)
    for (const line of commits.slice(0, MAX_COMMITS)) console.log(`    ${line}`)
    if (commits.length > MAX_COMMITS) console.log(`    … и ещё ${commits.length - MAX_COMMITS}`)
    if (dirty) console.log('    код изменён и ещё не закоммичен')
    if (missing.length) console.log(`    пути из code: не найдены: ${missing.join(', ')}`)
  }
}
if (unbound.length) console.log(`\n[help:stale] без code: (не с чем сверять): ${unbound.join(', ')}`)
if (drafts.length) console.log(`\n[help:stale] черновики (${drafts.length}): ${drafts.join(', ')}`)
