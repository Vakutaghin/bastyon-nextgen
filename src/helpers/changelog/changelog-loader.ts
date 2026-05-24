/**
 * Загрузчик changelog-файлов.
 *
 * Файлы лежат в `changelogs/v{X.Y.Z}/{lang}.desc.md` в корне репозитория.
 * Все варианты бандлятся в приложение через `import.meta.glob` (eager + raw),
 * так что для добавления новой версии достаточно положить новые .md рядом и
 * пересобрать приложение — никакой регистрации в коде не нужно.
 */

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

/** Compares "1.2.3" vs "1.2.4" — returns positive if `a > b`, like Array.sort. */
function compareSemver(a: string, b: string): number {
  const ap = a.split('.').map((n) => parseInt(n, 10) || 0)
  const bp = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(ap.length, bp.length)
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0
    const bv = bp[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

const ENTRIES = buildEntries()

export function getAllChangelogEntries(): ChangelogEntry[] {
  return ENTRIES
}

export function getLatestChangelogEntry(): ChangelogEntry | undefined {
  return ENTRIES[0]
}

/**
 * Возвращает markdown для версии в нужном языке. Если для запрошенного языка
 * перевода нет — берём fallback (en), затем любой доступный.
 */
export function getChangelogText(
  entry: ChangelogEntry,
  language: AppLanguage,
): string {
  return (
    entry.byLanguage[language]
    ?? entry.byLanguage[FALLBACK_LANGUAGE]
    ?? Object.values(entry.byLanguage)[0]
    ?? ''
  )
}

/** Текущая версия приложения (инжектится Vite из package.json). */
export const CURRENT_APP_VERSION: string = __APP_VERSION__
