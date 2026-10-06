import { t } from '@/i18n'

import { parseSupportReport } from './support-report'

/** Сведения для поддержки в списке чатов и в цитате ответа — коротко, без JSON. */
export function supportReportPreview(text: string): string | null {
  const report = parseSupportReport(text)
  if (!report) return null
  const label = `🧾 ${t('messenger.supportReport.title')}`
  return report.total > 1 ? `${label} (${report.part}/${report.total})` : label
}
