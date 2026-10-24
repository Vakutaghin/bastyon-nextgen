// Загрузка справки: файлы нужного языка (и русские — они основные), картинки,
// история версий из changelogs/, разбор. Этот модуль и всё, что он тянет
// (markdown-it), грузятся только при открытии справки — см.
// composables/use-help-library.ts. Черновики статей видны при разработке (и в
// тестах), в сборку они не попадают.
import { resolveDeepLink } from '@/helpers/common/deep-link'
import { buildHelpLibrary } from './help-library'
import { RELEASES_TOPIC, releaseHelpFiles } from './help-releases'
import type { HelpLibrary, HelpLocale } from './help-types'

export async function loadHelpLibrary(
  locale: HelpLocale,
  drafts: boolean = import.meta.env.DEV
): Promise<HelpLibrary> {
  const [ru, own, images] = await Promise.all([
    import('./help-files-ru').then((m) => m.HELP_FILES_RU),
    locale === 'en' ? import('./help-files-en').then((m) => m.HELP_FILES_EN) : Promise.resolve({}),
    import('./help-images').then((m) => m.HELP_IMAGES),
  ])
  const files = { ...ru, ...own }
  const releases = releaseHelpFiles(locale, files)
  return buildHelpLibrary(locale, {
    files: { ...files, ...releases.files },
    images,
    resolveApp: resolveDeepLink,
    drafts,
    generated: { [RELEASES_TOPIC]: releases.ids },
  })
}
