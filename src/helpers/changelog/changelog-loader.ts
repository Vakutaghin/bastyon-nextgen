/**
 * Загрузчик changelog-файлов.
 *
 * Файлы лежат в `changelogs/v{X.Y.Z}/{lang}.desc.md` в корне репозитория.
 * Все варианты бандлятся в приложение через `import.meta.glob` (eager + raw),
 * так что для добавления новой версии достаточно положить новые .md рядом и
 * пересобрать приложение — никакой регистрации в коде не нужно.
 */

import { compareSemver } from '@/helpers/common/semver'
import type { AppLanguage } from '@/stores/ui-store'

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['ru', 'en']
const FALLBACK_LANGUAGE: AppLanguage = 'en'

export interface ChangelogEntry {
  /** Версия без префикса "v", например "0.1.0" */
  version: string
  /** Версия с префиксом, для отображения */
  displayVersion: string
  /** Карта язык → markdown-исходник */
  byLanguage: Partial<Record<AppLanguage, string>>
}

/** Текущая версия приложения (инжектится Vite из package.json). */
export const CURRENT_APP_VERSION: string = __APP_VERSION__

const rawModules = import.meta.glob('/changelogs/v*/*.desc.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const PATH_RE = /\/changelogs\/v([^/]+)\/(\w+)\.desc\.md$/

function buildEntries(): ChangelogEntry[] {
  const byVersion = new Map<string, ChangelogEntry>()

  for (const [path, content] of Object.entries(rawModules)) {
    const match = PATH_RE.exec(path)
    if (!match) continue
    const [, version, lang] = match
    if (!version || !lang) continue
    if (!SUPPORTED_LANGUAGES.includes(lang as AppLanguage)) continue

    let entry = byVersion.get(version)
    if (!entry) {
      entry = {
        version,
        displayVersion: `v${version}`,
        byLanguage: {},
      }
      byVersion.set(version, entry)
    }
    entry.byLanguage[lang as AppLanguage] = content
  }

  return [...byVersion.values()].sort((a, b) => compareSemver(b.version, a.version))
}

const ENTRIES = buildEntries()

export function getAllChangelogEntries(): ChangelogEntry[] {
  return ENTRIES
}

/**
 * Запись, соответствующая версии приложения (N34).
 *
 * «Что нового» раньше ключевалось на САМОЙ СВЕЖЕЙ папке `changelogs/`, а не на
 * версии сборки: подготовленный заранее changelog следующего релиза всплывал у
 * пользователей текущей версии. Берём точное совпадение, иначе — ближайшую
 * версию не новее текущей.
 */
export function getChangelogEntryForVersion(
  version: string = CURRENT_APP_VERSION
): ChangelogEntry | undefined {
  const exact = ENTRIES.find((e) => e.version === version)
  if (exact) return exact
  // ENTRIES отсортированы по убыванию — первая подходящая и есть ближайшая.
  return ENTRIES.find((e) => compareSemver(e.version, version) <= 0)
}

/**
 * Возвращает markdown для версии в нужном языке. Если для запрошенного языка
 * перевода нет — берём fallback (en), затем любой доступный.
 */
export function getChangelogText(entry: ChangelogEntry, language: AppLanguage): string {
  return (
    entry.byLanguage[language] ??
    entry.byLanguage[FALLBACK_LANGUAGE] ??
    Object.values(entry.byLanguage)[0] ??
    ''
  )
}
