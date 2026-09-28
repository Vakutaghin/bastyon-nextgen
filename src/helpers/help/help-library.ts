// Справка на одном языке целиком: статьи, оглавление, словарь, указатель и
// порядок чтения. Русские статьи — основные: у английской берём текст и
// ключевые слова, а платформы и код — из русской. Нет английской статьи —
// показываем русскую. Черновики (`draft: true`) видны только при разработке:
// русский черновик в сборке скрыт на всех языках, а английский заменяется
// русской статьёй, как непереведённый. Ошибки в файлах собираются в
// `problems`: их проверяет тест содержимого, в приложении они не видны.
import { splitFrontmatter } from './help-frontmatter'
import {
  linkedTopic,
  parseArticle,
  plainText,
  type HelpParseContext,
  type HelpParsedLink,
} from './help-markdown'
import { parseReadme } from './help-toc'
import type {
  HelpBlock,
  HelpGlossaryEntry,
  HelpIndexEntry,
  HelpLibrary,
  HelpLocale,
  HelpProblem,
  HelpTocNode,
  HelpTopic,
} from './help-types'

export interface HelpSources {
  /** Файлы справки: 'ru/faq.md' → текст. */
  files: Record<string, string>
  /** Картинки: 'images/p2p.svg' → URL в сборке. */
  images: Record<string, string>
  /** `bastyon://…` → путь в приложении; null — такого раздела нет. */
  resolveApp: (href: string) => string | null
  /** Показывать черновики: при разработке — да, в сборке — нет. */
  drafts?: boolean
}

export const PRIMARY_LOCALE: HelpLocale = 'ru'
export const HOME_FILE = 'README'
export const GLOSSARY_TOPIC = 'glossary'
const TOPIC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** `../images/a.svg` из help/ru/ → 'images/a.svg'. */
export function resolveRelative(fromDir: string, path: string): string {
  const parts = fromDir.split('/').filter(Boolean)
  for (const segment of path.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  return parts.join('/')
}

function topicIds(files: Record<string, string>, locale: HelpLocale): string[] {
  const ids: string[] = []
  for (const path of Object.keys(files)) {
    const m = new RegExp(`^${locale}/([^/]+)\\.md$`).exec(path)
    if (m && m[1] !== HOME_FILE) ids.push(m[1] ?? '')
  }
  return ids.sort()
}

function walk(
  nodes: HelpTocNode[],
  visit: (node: HelpTocNode, parents: string[]) => void,
  parents: string[] = []
): void {
  for (const node of nodes) {
    visit(node, parents)
    walk(node.children, visit, [...parents, node.id])
  }
}

/**
 * Оглавление без скрытых черновиков. Готовые статьи из черновой книги
 * поднимаются на её место: статью можно выпустить раньше, чем книгу.
 */
function visibleToc(
  nodes: HelpTocNode[],
  hidden: ReadonlySet<string>,
  topics: Map<string, HelpTopic>
): HelpTocNode[] {
  return nodes.flatMap((node) => {
    const children = visibleToc(node.children, hidden, topics)
    if (hidden.has(node.id)) return children
    return [{ ...node, children, ...(topics.get(node.id)?.draft ? { draft: true as const } : {}) }]
  })
}

/** Разделы словаря — заголовки второго уровня и всё, что под ними. */
function glossaryEntries(topic: HelpTopic | undefined): Map<string, HelpGlossaryEntry> {
  const entries = new Map<string, HelpGlossaryEntry>()
  let current: HelpGlossaryEntry | null = null
  for (const block of topic?.blocks ?? []) {
    if (block.t === 'heading' && block.level === 2) {
      current = { id: block.id, term: plainText(block.c), blocks: [] as HelpBlock[] }
      entries.set(block.id, current)
    } else if (current) {
      current.blocks.push(block)
    }
  }
  return entries
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/ё/g, 'е')
}

export function buildHelpLibrary(locale: HelpLocale, sources: HelpSources): HelpLibrary {
  const problems: HelpProblem[] = []
  const report = (file: string, messages: string[]): void => {
    for (const message of messages) problems.push({ file, message })
  }
  const { files } = sources

  const ids = topicIds(files, PRIMARY_LOCALE)
  for (const id of ids) {
    if (!TOPIC_ID.test(id))
      report(`${PRIMARY_LOCALE}/${id}.md`, [
        'имя файла — латиница, цифры и дефисы: оно же адрес статьи',
      ])
  }
  if (locale !== PRIMARY_LOCALE) {
    for (const id of topicIds(files, locale)) {
      if (!ids.includes(id))
        report(`${locale}/${id}.md`, ['статьи нет на русском: русская версия основная'])
    }
  }

  const drafts = sources.drafts ?? false
  const primaries = new Map(
    ids.map((id) => [id, splitFrontmatter(files[`${PRIMARY_LOCALE}/${id}.md`] ?? '')])
  )
  const hidden = new Set(drafts ? [] : ids.filter((id) => primaries.get(id)?.meta.draft))
  const visible = ids.filter((id) => !hidden.has(id))

  const topics = new Map<string, HelpTopic>()
  const links = new Map<string, HelpParsedLink[]>()
  for (const [id, primary] of primaries) {
    if (hidden.has(id)) continue
    const ownRaw = files[`${locale}/${id}.md`]
    const own = ownRaw === undefined ? null : splitFrontmatter(ownRaw)
    // Перевод ещё черновик, а русская статья готова — показываем русскую.
    const fallback = !own || (own.meta.draft && !drafts)
    const lang = fallback ? PRIMARY_LOCALE : locale
    const file = `${lang}/${id}.md`
    const front = !fallback && own ? own : primary
    report(file, front.problems)
    if (lang !== PRIMARY_LOCALE && (front.meta.platforms.length || front.meta.code.length)) {
      report(file, ['platforms и code пишутся только в русской статье'])
    }
    const ctx: HelpParseContext = {
      topic: id,
      resolveImage: (path) => sources.images[resolveRelative(`${lang}`, path)] ?? null,
      resolveApp: sources.resolveApp,
      hidden,
    }
    const parsed = parseArticle(front.body, ctx)
    report(file, parsed.problems)
    links.set(id, parsed.links)
    topics.set(id, {
      id,
      title: parsed.title || id,
      blocks: parsed.blocks,
      headings: parsed.headings,
      text: parsed.text,
      keywords: front.meta.keywords,
      platforms: primary.meta.platforms,
      code: primary.meta.code,
      fallback,
      draft: front.meta.draft,
    })
  }

  const readmeLang = files[`${locale}/${HOME_FILE}.md`] !== undefined ? locale : PRIMARY_LOCALE
  const readmeFile = `${readmeLang}/${HOME_FILE}.md`
  const readme = parseReadme(files[readmeFile] ?? '', {
    topic: HOME_FILE,
    resolveImage: (path) => sources.images[resolveRelative(readmeLang, path)] ?? null,
    resolveApp: sources.resolveApp,
    hidden,
  })
  report(readmeFile, readme.problems)
  links.set(HOME_FILE, readme.links)
  const toc = visibleToc(readme.toc, hidden, topics)

  // Оглавление: каждая статья ровно один раз, и только существующие.
  const order: string[] = []
  const trail = new Map<string, string[]>()
  walk(toc, (node, parents) => {
    if (!topics.has(node.id))
      report(readmeFile, [`в оглавлении статья, которой нет: ${node.id}.md`])
    else if (trail.has(node.id)) report(readmeFile, [`статья в оглавлении дважды: ${node.id}.md`])
    else {
      order.push(node.id)
      trail.set(node.id, parents)
    }
  })
  for (const id of visible) {
    if (!trail.has(id)) report(`${PRIMARY_LOCALE}/${id}.md`, ['статьи нет в оглавлении README.md'])
  }

  const glossary = glossaryEntries(topics.get(GLOSSARY_TOPIC))

  // Ссылки: статья, раздел в ней и термин словаря должны существовать.
  for (const [from, list] of links) {
    const topic = topics.get(from)
    const file =
      from === HOME_FILE ? readmeFile : `${topic?.fallback ? PRIMARY_LOCALE : locale}/${from}.md`
    for (const { to, text } of list) {
      // Ссылка на скрытый черновик — не ошибка: в сборке она просто текст.
      if (to.kind === 'broken' && hidden.has(linkedTopic(to.href) ?? '')) continue
      if (to.kind === 'broken') report(file, [`ссылка никуда не ведёт: [${text}](${to.href})`])
      else if (to.kind === 'term' && !glossary.has(to.anchor)) {
        report(file, [`в словаре нет термина #${to.anchor} («${text}»)`])
      } else if (to.kind === 'topic') {
        const target = topics.get(to.topic)
        if (!target) report(file, [`ссылка на статью, которой нет: ${to.topic}.md («${text}»)`])
        else if (to.anchor && !target.headings.some((h) => h.id === to.anchor)) {
          report(file, [`в статье ${to.topic}.md нет раздела #${to.anchor} («${text}»)`])
        }
      }
    }
  }

  // Указатель: ключевые слова из шапок и заголовки статей.
  const byKeyword = new Map<string, HelpIndexEntry>()
  const addKeyword = (keyword: string, id: string): void => {
    const key = normalizeKeyword(keyword)
    if (!key) return
    const entry = byKeyword.get(key) ?? { keyword: keyword.trim(), topics: [] }
    if (!entry.topics.includes(id)) entry.topics.push(id)
    byKeyword.set(key, entry)
  }
  for (const id of order) {
    const topic = topics.get(id) as HelpTopic
    addKeyword(topic.title, id)
    for (const keyword of topic.keywords) addKeyword(keyword, id)
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const index = [...byKeyword.values()].sort((a, b) => collator.compare(a.keyword, b.keyword))
  for (const entry of index) entry.topics.sort((a, b) => order.indexOf(a) - order.indexOf(b))

  return {
    locale,
    title: readme.title,
    intro: readme.intro,
    toc,
    topics,
    order,
    trail,
    glossary,
    index,
    problems,
  }
}
