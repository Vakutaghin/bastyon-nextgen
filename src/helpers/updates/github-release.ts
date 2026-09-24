/**
 * Последний релиз приложения на GitHub — источник правды о новой версии.
 *
 * Своего сервера обновлений у приложения нет, а релизы и так собираются
 * workflow'ом `release.yml` и публикуются с тегом `vX.Y.Z`. Эндпоинт
 * `releases/latest` отдаёт только опубликованный не-предрелиз, так что
 * черновик подготовленного релиза пользователям не всплывёт.
 *
 * Здесь только разбор и проверки — сеть, троттлинг и состояние в
 * `@/composables/use-app-update`.
 */

import { isNewerVersion, normalizeVersion } from '@/helpers/common/semver'

/** Репозиторий, из которого приложение берёт релизы. */
export const UPDATE_REPO = 'Vakutaghin/bastyon-nextgen'

/** GitHub API: последний опубликованный релиз (без черновиков и предрелизов). */
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`

/** Страница релизов — куда ведём, если конкретный релиз почему-то без ссылки. */
export const RELEASES_PAGE_URL = `https://github.com/${UPDATE_REPO}/releases`

export interface LatestRelease {
  /** Версия без префикса: `0.3.0`. */
  version: string
  /** Тег как он есть в GitHub: `v0.3.0`. */
  tag: string
  /** Страница релиза со всеми установщиками. */
  pageUrl: string
  /** ISO-дата публикации или `null`, если GitHub её не отдал. */
  publishedAt: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Разбирает ответ `releases/latest`. Возвращает `null` на всём, чему нельзя
 * верить: черновик, предрелиз, тег без номера версии.
 */
export function parseLatestRelease(raw: unknown): LatestRelease | null {
  const json = asRecord(raw)
  if (!json) return null
  if (json.draft === true || json.prerelease === true) return null

  const tag = asString(json.tag_name)
  if (!tag) return null

  const version = normalizeVersion(tag)
  if (!version) return null

  return {
    version,
    tag,
    pageUrl: asString(json.html_url) ?? `${RELEASES_PAGE_URL}/tag/${tag}`,
    publishedAt: asString(json.published_at),
  }
}

/**
 * Релиз новее установленной сборки. Отдельная функция, чтобы «новее» читалось
 * в одном месте: у сборки из исходников версия может быть какой угодно, и
 * тогда обновление не предлагается (см. `isNewerVersion`).
 */
export function isUpdateAvailable(release: LatestRelease, currentVersion: string): boolean {
  return isNewerVersion(release.version, currentVersion)
}
