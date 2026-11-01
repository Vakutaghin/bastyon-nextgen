// Сводка настроек поста одной строкой — у окна поста и окна загрузки ролика.

import { bcp47, LOCALE_NAMES, t, type Locale } from '@/i18n'

const VISIBILITY_LABELS: Record<string, string> = {
  '0': 'postComposer.visibilityAll',
  '1': 'postComposer.visibilitySubscribers',
  '2': 'postComposer.visibilityRegistered',
  '3': 'postComposer.visibilityPaid',
}

/** «Все · Русский · Сразу» — видимость, язык и время публикации одной строкой. */
export function postSettingsSummary(
  settings: { visibility: string; language: string; scheduledTime: number },
  locale: string
): string {
  const when =
    settings.scheduledTime > 1
      ? new Intl.DateTimeFormat(bcp47(locale), {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(settings.scheduledTime * 1000)
      : t('postComposer.schedulePlaceholder')
  return [
    t(VISIBILITY_LABELS[settings.visibility] ?? VISIBILITY_LABELS['0']!),
    LOCALE_NAMES[settings.language as Locale] ?? settings.language,
    when,
  ].join(' · ')
}
