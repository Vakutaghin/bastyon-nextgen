// Поиск по тексту справки (вкладка «Поиск»). Индекс строится при первом
// поиске и живёт, пока жива загруженная справка. Сначала ищем статьи, где
// есть все слова запроса; не нашлось — хотя бы одно.
import MiniSearch from 'minisearch'
import {
  markWords,
  queryStems,
  searchTerm,
  splitWords,
  wordMatches,
  type HelpMarkPart,
} from './help-stem'
import type { HelpLibrary } from './help-types'

interface SearchDoc {
  id: string
  title: string
  keywords: string
  headings: string
  text: string
}

export interface HelpSearchHit {
  id: string
  title: string
  snippet: HelpMarkPart[]
}

const SNIPPET_BEFORE = 50
const SNIPPET_LENGTH = 140

/** Кусок текста вокруг первого найденного слова, найденные слова отмечены. */
export function snippet(text: string, stems: readonly string[]): HelpMarkPart[] {
  let first = -1
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (wordMatches(m[0], stems)) {
      first = m.index ?? 0
      break
    }
  }
  let start = first < 0 ? 0 : Math.max(0, first - SNIPPET_BEFORE)
  if (start > 0) {
    const space = text.indexOf(' ', start)
    if (space >= 0 && space < first) start = space + 1
  }
  let end = Math.min(text.length, start + SNIPPET_LENGTH)
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > start) end = space
  }
  const piece = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
  return markWords(piece, stems)
}

export class HelpSearch {
  private readonly mini: MiniSearch<SearchDoc>

  constructor(private readonly library: HelpLibrary) {
    this.mini = new MiniSearch<SearchDoc>({
      fields: ['title', 'keywords', 'headings', 'text'],
      storeFields: [],
      tokenize: splitWords,
      processTerm: (term) => searchTerm(term),
      searchOptions: {
        boost: { title: 4, keywords: 3, headings: 2 },
        prefix: true,
        fuzzy: 0.2,
        combineWith: 'AND',
      },
    })
    this.mini.addAll(
      library.order.map((id) => {
        const topic = library.topics.get(id)
        return {
          id,
          title: topic?.title ?? id,
          keywords: topic?.keywords.join(' ') ?? '',
          headings: topic?.headings.map((h) => h.text).join(' ') ?? '',
          text: topic?.text ?? '',
        }
      })
    )
  }

  search(query: string, limit = 30): HelpSearchHit[] {
    const q = query.trim()
    const stems = queryStems(q)
    if (!stems.length) return []
    let results = this.mini.search(q)
    if (!results.length) results = this.mini.search(q, { combineWith: 'OR' })
    return results.slice(0, limit).map((result) => {
      const topic = this.library.topics.get(String(result.id))
      return {
        id: String(result.id),
        title: topic?.title ?? String(result.id),
        snippet: snippet(topic?.text ?? '', stems),
      }
    })
  }
}

const cache = new WeakMap<HelpLibrary, HelpSearch>()

export function helpSearch(library: HelpLibrary): HelpSearch {
  let search = cache.get(library)
  if (!search) {
    search = new HelpSearch(library)
    cache.set(library, search)
  }
  return search
}
