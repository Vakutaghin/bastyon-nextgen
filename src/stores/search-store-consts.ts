// Константы и типы стора поиска

/** Максимальная длина истории поиска */
export const MAX_HISTORY_LENGTH = 10

/** Ключ в IndexedDB (таблица settings), под которым лежит история поиска. */
export const SEARCH_HISTORY_STORAGE_KEY = 'bastyonSearchHistory'

/** Категория записи в истории — определяет UI и поведение при клике. */
export type SearchHistoryKind = 'query' | 'user' | 'tag' | 'app'

/**
 * Запись в истории поиска.
 *
 * `value` зависит от `kind`:
 * - `query` — нормализованная строка запроса;
 * - `user`  — адрес профиля (для прямой навигации);
 * - `tag`   — имя тега без `#`;
 * - `app`   — id mini-app.
 *
 * `label` — то, что показать пользователю в Recent-блоке. Для `query`
 * совпадает с `value`; для `user` — ник / адрес, для `app` — название.
 *
 * `meta` — необязательные данные, которые могут пригодиться для рендера
 * (аватарка пользователя, иконка приложения и т.п.).
 */
export interface SearchHistoryEntry {
  kind: SearchHistoryKind
  value: string
  label?: string
  addedAt: number
  meta?: {
    avatar?: string
    icon?: string
    name?: string
  }
}

/** Совпадение двух записей считается «той же записью» — для дедупликации. */
export function isSameHistoryEntry(a: SearchHistoryEntry, b: SearchHistoryEntry): boolean {
  return a.kind === b.kind && a.value === b.value
}
