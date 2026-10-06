/**
 * Понятные разделы каталога вместо сырых тегов. Теги ставят авторы приложений
 * как придётся и на разных языках («music» и «музыка», «education» и
 * «образование»), а человеку нужно несколько разделов. Раздел — набор тегов:
 * нода ищет по любому из них (`getapps` с `tags` — это «или»), но с учётом
 * регистра, поэтому в запрос уходят и варианты с заглавной буквы.
 */

export type MiniAppCategoryId =
  | 'music'
  | 'video'
  | 'games'
  | 'learning'
  | 'growth'
  | 'community'
  | 'finance'
  | 'privacy'
  | 'tools'

export interface MiniAppCategory {
  id: MiniAppCategoryId
  /** Теги в нижнем регистре. */
  tags: readonly string[]
}

export const MINI_APP_CATEGORIES: readonly MiniAppCategory[] = [
  {
    id: 'music',
    tags: ['music', 'музыка', 'radio', 'радио', 'audio', 'аудио', 'songs', 'песни', 'karaoke'],
  },
  {
    id: 'video',
    tags: ['video', 'videos', 'видео', 'youtube', 'shorts', 'movies', 'кино', 'entertainment'],
  },
  { id: 'games', tags: ['game', 'games', 'игры', 'игра', 'tetris', 'тетрис', 'puzzle'] },
  {
    id: 'learning',
    tags: [
      'education',
      'образование',
      'самообразование',
      'learning',
      'обучение',
      'english',
      'английский',
      'science',
      'наука',
      'principia',
      'interacitve_book',
    ],
  },
  {
    id: 'growth',
    tags: [
      'саморазвитие',
      'психология',
      'отношения',
      'жизнь',
      'здоровье',
      'health',
      'psychology',
      'faith',
      'religion',
      'вера',
    ],
  },
  { id: 'community', tags: ['chat', 'чат', 'social', 'общество', 'community', 'map', 'карта'] },
  {
    id: 'finance',
    tags: ['finance', 'финансы', 'crypto', 'крипта', 'pkoin', 'exchange', 'обмен', 'wallet'],
  },
  {
    id: 'privacy',
    tags: ['privacy', 'приватность', 'security', 'безопасность', 'vpn', 'впн', 'proxy', 'прокси'],
  },
  { id: 'tools', tags: ['tools', 'инструменты', 'bastyon', 'explorer'] },
]

/**
 * Разделы встроенных приложений: тегов у них нет. Ключ — id из
 * `registry/built-in.ts`.
 */
export const BUILT_IN_CATEGORIES: Readonly<Record<string, MiniAppCategoryId>> = {
  'wpkoin.app': 'finance',
  'swipelux.app': 'finance',
  'p2p.pkoin.app': 'finance',
  'barteron.pocketnet.app': 'community',
  'app.pocketnet.docs': 'tools',
  'app.pocketnet.blockexplorer': 'tools',
}

export function categoryById(id: MiniAppCategoryId): MiniAppCategory {
  return MINI_APP_CATEGORIES.find((c) => c.id === id)!
}

/** Разделы, в которые попадает приложение с такими тегами. */
export function categoriesOfTags(tags: readonly string[]): MiniAppCategoryId[] {
  const lower = new Set(tags.map((t) => t.trim().toLowerCase()))
  return MINI_APP_CATEGORIES.filter((c) => c.tags.some((t) => lower.has(t))).map((c) => c.id)
}

/** Теги раздела для запроса к ноде: как в списке и с заглавной буквы. */
export function categoryQueryTags(id: MiniAppCategoryId): string[] {
  const tags = categoryById(id).tags
  return [...tags, ...tags.map((t) => t.charAt(0).toUpperCase() + t.slice(1))]
}

/**
 * Теги, с которыми приложение не попадает на полку в ленте. Продвигать в ленте
 * обход блокировок нельзя (запрет популяризации, 149-ФЗ, с 01.03.2024); в
 * каталоге такие приложения остаются.
 */
const SHELF_EXCLUDED_TAGS = new Set(['vpn', 'впн', 'proxy', 'прокси'])

export function isShelfAllowed(tags: readonly string[]): boolean {
  return !tags.some((t) => SHELF_EXCLUDED_TAGS.has(t.trim().toLowerCase()))
}
