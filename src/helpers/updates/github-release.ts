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

/** APK релиза — для обновления изнутри приложения на Android. */
export interface ReleaseApk {
  url: string
  /** Размер в байтах. */
  size: number
  /** SHA-256 файла, как его посчитал GitHub (поле `digest` у файла релиза). */
  sha256: string
}

export interface LatestRelease {
  /** Версия без префикса: `0.3.0`. */
  version: string
  /** Тег как он есть в GitHub: `v0.3.0`. */
  tag: string
  /** Страница релиза со всеми установщиками. */
  pageUrl: string
  /** ISO-дата публикации или `null`, если GitHub её не отдал. */
  publishedAt: string | null
  /** APK, который телефон может поставить сам; `null` — только со страницы релиза. */
  androidApk: ReleaseApk | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/** Имя APK в релизе (release.yml): `Android-Bastyon-NextGen-<версия>.apk`. */
const APK_NAME = /^Android-.+\.apk$/

/**
 * APK релиза. Берём только файл из этого же релиза этого репозитория и только
 * с хешем: без `digest` скачанное нечем сверить, и телефон пойдёт на страницу
 * релиза, как раньше.
 */
export function parseReleaseApk(assets: unknown, tag: string): ReleaseApk | null {
  if (!Array.isArray(assets)) return null
  const prefix = `https://github.com/${UPDATE_REPO}/releases/download/${tag}/`
  for (const raw of assets) {
    const asset = asRecord(raw)
    const name = asString(asset?.name)
    if (!asset || !name || !APK_NAME.test(name)) continue
    const url = asString(asset.browser_download_url)
    const size = asset.size
    const digest = /^sha256:([0-9a-f]{64})$/i.exec(asString(asset.digest) ?? '')
    if (!url?.startsWith(prefix) || typeof size !== 'number' || size <= 0 || !digest) continue
    return { url, size, sha256: digest[1]!.toLowerCase() }
  }
  return null
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
    androidApk: parseReleaseApk(json.assets, tag),
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
