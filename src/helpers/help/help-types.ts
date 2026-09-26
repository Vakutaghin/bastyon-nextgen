// Справка: статьи из help/<язык>/*.md, разобранные в дерево узлов. Формат
// файлов описан в help/README.md; здесь — то, во что он превращается.

export type HelpLocale = 'ru' | 'en'

/** Где работает то, что описывает статья (frontmatter `platforms`). */
export type HelpPlatform = 'desktop' | 'web' | 'mobile'

/** Врезки GitHub: `> [!NOTE]`, `> [!TIP]`… */
export type HelpAlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'

export type HelpAlign = 'left' | 'center' | 'right' | null

/** Куда ведёт ссылка из статьи. */
export type HelpLinkTarget =
  /** Главная справки (README.md). */
  | { kind: 'home' }
  /** Статья `id.md`, возможно раздел в ней. */
  | { kind: 'topic'; topic: string; anchor: string | null }
  /** Термин словаря `glossary.md#термин` — всплывающее определение. */
  | { kind: 'term'; anchor: string }
  /** `bastyon://…` — раздел приложения. */
  | { kind: 'app'; href: string; path: string }
  | { kind: 'external'; href: string }
  /** Ссылка, которую не удалось разобрать: показывается простым текстом. */
  | { kind: 'broken'; href: string }

export type HelpInline =
  | { t: 'text'; v: string }
  | { t: 'strong' | 'em' | 's'; c: HelpInline[] }
  | { t: 'code'; v: string }
  | { t: 'br' }
  | { t: 'link'; to: HelpLinkTarget; c: HelpInline[] }
  /** `theme`: картинка только для светлой или только для тёмной темы (`#gh-dark-mode-only`). */
  | { t: 'image'; src: string; alt: string; theme: 'light' | 'dark' | null }

export type HelpBlock =
  | { t: 'heading'; level: number; id: string; c: HelpInline[] }
  | { t: 'p'; c: HelpInline[] }
  | { t: 'list'; ordered: boolean; start: number; tight: boolean; items: HelpBlock[][] }
  | { t: 'quote'; c: HelpBlock[] }
  | { t: 'alert'; kind: HelpAlertKind; c: HelpBlock[] }
  /** `<details><summary>…</summary>` — сворачиваемые подробности. */
  | { t: 'details'; summary: string; c: HelpBlock[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'table'; align: HelpAlign[]; head: HelpInline[][]; rows: HelpInline[][][] }
  | { t: 'hr' }

export interface HelpHeading {
  id: string
  level: number
  text: string
}

export interface HelpTopic {
  id: string
  title: string
  blocks: HelpBlock[]
  headings: HelpHeading[]
  /** Весь текст статьи одной строкой — для поиска и фрагментов в выдаче. */
  text: string
  keywords: string[]
  platforms: HelpPlatform[]
  /** Код, который описывает статья: по нему `pnpm help:stale` ищет устаревшие статьи. */
  code: string[]
  /** Статьи нет на языке интерфейса — показан русский текст. */
  fallback: boolean
}

export interface HelpTocNode {
  id: string
  label: string
  children: HelpTocNode[]
}

export interface HelpGlossaryEntry {
  /** Якорь раздела в glossary.md. */
  id: string
  term: string
  blocks: HelpBlock[]
}

export interface HelpIndexEntry {
  keyword: string
  topics: string[]
}

/** Ошибка в файлах справки: показывает её тест, в приложении не видна. */
export interface HelpProblem {
  file: string
  message: string
}

export interface HelpLibrary {
  locale: HelpLocale
  title: string
  intro: HelpBlock[]
  toc: HelpTocNode[]
  topics: Map<string, HelpTopic>
  /** Порядок чтения подряд — обход оглавления. */
  order: string[]
  /** Книги, в которых лежит статья, от корня: для хлебных крошек. */
  trail: Map<string, string[]>
  glossary: Map<string, HelpGlossaryEntry>
  index: HelpIndexEntry[]
  problems: HelpProblem[]
}
