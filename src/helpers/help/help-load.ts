// Загрузка справки: файлы нужного языка (и русские — они основные), картинки,
// разбор. Этот модуль и всё, что он тянет (markdown-it), грузятся только
// при открытии справки — см. composables/use-help-library.ts.
import { resolveDeepLink } from '@/helpers/common/deep-link'
import { buildHelpLibrary } from './help-library'
import type { HelpLibrary, HelpLocale } from './help-types'

export async function loadHelpLibrary(locale: HelpLocale): Promise<HelpLibrary> {
  const [ru, own, images] = await Promise.all([
    import('./help-files-ru').then((m) => m.HELP_FILES_RU),
    locale === 'en' ? import('./help-files-en').then((m) => m.HELP_FILES_EN) : Promise.resolve({}),
    import('./help-images').then((m) => m.HELP_IMAGES),
  ])
  return buildHelpLibrary(locale, { files: { ...ru, ...own }, images, resolveApp: resolveDeepLink })
}
