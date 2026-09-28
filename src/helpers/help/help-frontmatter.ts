// Шапка статьи между `---`: ключевые слова для «Указателя», платформы, код,
// который описывает статья, и пометка черновика. Это не весь YAML, а его
// маленькая часть — ровно то, что нужно справке: `ключ: значение`,
// `ключ: [a, b]` и список строками `  - a`. Всё остальное — ошибка, её покажет
// тест содержимого.
import type { HelpPlatform } from './help-types'

export interface HelpFrontmatter {
  keywords: string[]
  platforms: HelpPlatform[]
  code: string[]
  /** `draft: true` — статья пишется: в сборку не попадает. */
  draft: boolean
}

const PLATFORMS: readonly HelpPlatform[] = ['desktop', 'web', 'mobile']
const KEYS = ['keywords', 'platforms', 'code', 'draft'] as const
type Key = (typeof KEYS)[number]

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

function unquote(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1)
  }
  return v
}

/** Комментарий ` # …` в конце строки — если решётка не в кавычках. */
function stripComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) {
      return line.slice(0, i).trimEnd()
    }
  }
  return line
}

/** `[a, "b, c", 'd']` → ['a', 'b, c', 'd']. */
function splitFlowList(inner: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  for (const ch of inner) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      current += ch
      quote = ch
    } else if (ch === ',') {
      items.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  items.push(current)
  return items.map(unquote).filter((item) => item !== '')
}

export function splitFrontmatter(raw: string): {
  meta: HelpFrontmatter
  body: string
  problems: string[]
} {
  const meta: HelpFrontmatter = { keywords: [], platforms: [], code: [], draft: false }
  const problems: string[] = []
  const text = raw.replace(/^\uFEFF/, '')
  const match = FENCE.exec(text)
  if (!match) return { meta, body: text, problems }

  const values = new Map<Key, string[]>()
  let listKey: Key | null = null
  for (const rawLine of (match[1] ?? '').split(/\r?\n/)) {
    const line = stripComment(rawLine)
    if (!line.trim()) continue

    const item = /^\s+-\s+(.*)$/.exec(line)
    if (item) {
      if (listKey) values.get(listKey)?.push(unquote(item[1] ?? ''))
      else problems.push(`элемент списка без ключа: «${line.trim()}»`)
      continue
    }

    const pair = /^([A-Za-z]+):\s*(.*)$/.exec(line)
    if (!pair) {
      problems.push(`непонятная строка в шапке: «${line.trim()}»`)
      listKey = null
      continue
    }
    const key = pair[1] as Key
    const value = (pair[2] ?? '').trim()
    if (!KEYS.includes(key)) {
      problems.push(`неизвестный ключ в шапке: ${pair[1]}`)
      listKey = null
      continue
    }
    if (value === '') {
      values.set(key, [])
      listKey = key
    } else if (value.startsWith('[') && value.endsWith(']')) {
      values.set(key, splitFlowList(value.slice(1, -1)))
      listKey = null
    } else {
      values.set(key, [unquote(value)])
      listKey = null
    }
  }

  meta.keywords = values.get('keywords') ?? []
  meta.code = values.get('code') ?? []
  const draft = values.get('draft')
  if (draft) {
    if (draft.length === 1 && (draft[0] === 'true' || draft[0] === 'false')) {
      meta.draft = draft[0] === 'true'
    } else {
      problems.push(`draft: true или false, а не «${draft.join(', ')}»`)
    }
  }
  for (const platform of values.get('platforms') ?? []) {
    if ((PLATFORMS as readonly string[]).includes(platform)) {
      meta.platforms.push(platform as HelpPlatform)
    } else {
      problems.push(`неизвестная платформа: ${platform} (бывают ${PLATFORMS.join(', ')})`)
    }
  }
  return { meta, body: text.slice(match[0].length), problems }
}
