// История версий в справке: книга «История версий» (help/<язык>/releases.md)
// и статья на каждую вышедшую версию — из тех же changelogs/, что и окно
// «Что нового», второй копии нет. Статьи версий собираются при загрузке
// справки: в оглавлении они встают под книгу (HelpSources.generated), а их
// список дописывается в конец статьи книги.
import { getChangelogText, getReleasedChangelogEntries } from '@/helpers/changelog/changelog-loader'
import { PRIMARY_LOCALE } from './help-library'
import type { HelpLocale } from './help-types'

export const RELEASES_TOPIC = 'releases'

/** '0.13.3' → 'release-0-13-3': имя статьи — латиница, цифры и дефисы. */
export function releaseTopicId(version: string): string {
  const slug = version
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `release-${slug}`
}

export interface ReleaseHelpFiles {
  /** Статьи версий и статья книги со списком версий: 'ru/release-0-13-3.md' → текст. */
  files: Record<string, string>
  /** Статьи версий от новых к старым — так они идут в оглавлении. */
  ids: string[]
}

function titleOf(markdown: string): string {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? ''
}

/**
 * @param files - файлы справки из help/: к их releases.md дописывается список
 */
export function releaseHelpFiles(
  locale: HelpLocale,
  files: Record<string, string>
): ReleaseHelpFiles {
  const entries = getReleasedChangelogEntries()
  const ids = entries.map((e) => releaseTopicId(e.version))
  const out: Record<string, string> = {}
  const langs = locale === PRIMARY_LOCALE ? [PRIMARY_LOCALE] : [PRIMARY_LOCALE, locale]
  for (const lang of langs) {
    const list: string[] = []
    entries.forEach((entry, i) => {
      const text = getChangelogText(entry, lang)
      out[`${lang}/${ids[i]}.md`] = text
      list.push(`- [${titleOf(text) || entry.displayVersion}](${ids[i]}.md)`)
    })
    const book = files[`${lang}/${RELEASES_TOPIC}.md`]
    if (book !== undefined)
      out[`${lang}/${RELEASES_TOPIC}.md`] = `${book.trimEnd()}\n\n${list.join('\n')}\n`
  }
  return { files: out, ids }
}
