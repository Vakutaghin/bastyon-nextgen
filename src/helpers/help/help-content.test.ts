// Проверка настоящей справки (help/): всё, что делает её устаревшей или
// сломанной, падает здесь, а не у читателя. Правила — в help/README.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import ru from '@/locales/ru'
import en from '@/locales/en'
import { DEEP_LINK_SECTIONS } from '@/helpers/common/deep-link'
import { plainText } from './help-markdown'
import { loadHelpLibrary } from './help-load'
import type { HelpBlock, HelpInline, HelpLibrary, HelpLocale, HelpTocNode } from './help-types'

const ROOT = process.cwd()
const LOCALES: HelpLocale[] = ['ru', 'en']
/** С черновиками — проверяется всё, что написано; без них — то, что попадёт в сборку. */
const libraries = {} as Record<HelpLocale, HelpLibrary>
const releases = {} as Record<HelpLocale, HelpLibrary>

beforeAll(async () => {
  for (const locale of LOCALES) {
    libraries[locale] = await loadHelpLibrary(locale, true)
    releases[locale] = await loadHelpLibrary(locale, false)
  }
})

function inlinesOf(blocks: HelpBlock[]): HelpInline[][] {
  const out: HelpInline[][] = []
  for (const b of blocks) {
    if (b.t === 'heading' || b.t === 'p') out.push(b.c)
    else if (b.t === 'list') b.items.forEach((item) => out.push(...inlinesOf(item)))
    else if (b.t === 'quote' || b.t === 'alert' || b.t === 'details') out.push(...inlinesOf(b.c))
    else if (b.t === 'table') out.push(...b.head, ...b.rows.flat())
  }
  return out
}

function walkInlines(nodes: HelpInline[], visit: (node: HelpInline) => void): void {
  for (const node of nodes) {
    visit(node)
    if ('c' in node) walkInlines(node.c, visit)
  }
}

function eachInline(lib: HelpLibrary, visit: (node: HelpInline, topic: string) => void): void {
  for (const [id, topic] of lib.topics) {
    for (const nodes of inlinesOf(topic.blocks)) walkInlines(nodes, (node) => visit(node, id))
  }
  for (const nodes of inlinesOf(lib.intro)) walkInlines(nodes, (node) => visit(node, 'README'))
}

function tocShape(nodes: HelpTocNode[]): unknown[] {
  return nodes.map((n) => (n.children.length ? [n.id, tocShape(n.children)] : n.id))
}

/** Все строки интерфейса языка — без значков и многоточий по краям. */
function uiStrings(messages: unknown): Set<string> {
  const out = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') out.add(normalizeLabel(value))
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(messages)
  return out
}

function normalizeLabel(label: string): string {
  return label
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/[…:]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const UI_LABEL: Record<HelpLocale, RegExp> = { ru: /^«(.+)»$/, en: /^[“"](.+)[”"]$/ }
const UI_MESSAGES: Record<HelpLocale, unknown> = { ru, en }

/** meta.helpTopic маршрута, <HelpLink topic="…"> и openTopic('…'); привязка :topic="…" — не ссылка. */
const CONTEXT_REF = /(?:helpTopic:\s*['"]|(?<![:@.\w-])topic="|openTopic\(\s*['"])([a-z0-9-]+)['"]/g

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path)
  }
  return out
}

describe('справка в help/', () => {
  it.each(LOCALES)('%s: файлы разбираются без ошибок', (locale) => {
    const problems = libraries[locale].problems.map((p) => `${p.file}: ${p.message}`)
    expect(problems).toEqual([])
  })

  it.each(LOCALES)('%s: без черновиков справка тоже цела', (locale) => {
    const problems = releases[locale].problems.map((p) => `${p.file}: ${p.message}`)
    expect(problems).toEqual([])
    expect(releases[locale].order.length).toBeGreaterThan(0)
  })

  it('русская и английская справки одного состава и одной структуры', () => {
    const ids = (l: HelpLocale) =>
      [...libraries[l].topics.values()].filter((t) => !t.fallback).map((t) => t.id)
    expect(ids('en')).toEqual(ids('ru'))
    expect(tocShape(libraries.en.toc)).toEqual(tocShape(libraries.ru.toc))
  })

  it.each(LOCALES)('%s: у статьи есть вводный абзац — он же подпись в поиске', (locale) => {
    const withoutLead = [...libraries[locale].topics.values()]
      .filter((t) => t.blocks[0]?.t !== 'p')
      .map((t) => t.id)
    expect(withoutLead).toEqual([])
  })

  it.each(LOCALES)('%s: ссылки bastyon:// ведут в разделы приложения, а не в профиль', (locale) => {
    const bad: string[] = []
    eachInline(libraries[locale], (node, topic) => {
      if (node.t !== 'link' || node.to.kind !== 'app') return
      const section = node.to.path.split('/')[1] ?? ''
      if (node.to.path !== '/' && !DEEP_LINK_SECTIONS.has(section))
        bad.push(`${topic}: ${node.to.href}`)
    })
    expect(bad).toEqual([])
  })

  it.each(LOCALES)('%s: названия кнопок в кавычках жирным есть в интерфейсе', (locale) => {
    const known = uiStrings(UI_MESSAGES[locale])
    const missing: string[] = []
    eachInline(libraries[locale], (node, topic) => {
      if (node.t !== 'strong') return
      const label = UI_LABEL[locale].exec(plainText(node.c).trim())?.[1]
      if (label && !known.has(normalizeLabel(label))) missing.push(`${topic}: ${label}`)
    })
    expect(missing).toEqual([])
  })

  it('пути из code: существуют', () => {
    const missing = [...libraries.ru.topics.values()].flatMap((t) =>
      t.code.filter((path) => !existsSync(resolve(ROOT, path))).map((path) => `${t.id}: ${path}`)
    )
    expect(missing).toEqual([])
  })

  it('контекстная справка в коде ведёт на готовые статьи', () => {
    const refs = new Set<string>()
    for (const file of sourceFiles(resolve(ROOT, 'src'))) {
      const code = readFileSync(file, 'utf8')
      for (const m of code.matchAll(CONTEXT_REF)) {
        refs.add(m[1] ?? '')
      }
    }
    // Черновика в сборке нет: F1 и «?» открыли бы пустое место.
    const missing = [...refs].filter((id) => !releases.ru.topics.has(id))
    expect(missing).toEqual([])
  })
})
