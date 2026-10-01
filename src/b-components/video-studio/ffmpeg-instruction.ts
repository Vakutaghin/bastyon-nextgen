import { t } from '@/i18n'

/** Как поставить FFmpeg — под систему пользователя: общая подсказка забывала Windows. */
export function getFfmpegMissingInstruction(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/mac|darwin/i.test(ua)) return t('videoMsg.ffmpegMissingMac')
  if (/win/i.test(ua)) return t('videoMsg.ffmpegMissingWin')
  if (/linux/i.test(ua)) return t('videoMsg.ffmpegMissingLinux')
  return t('videoMsg.ffmpegMissingGeneric')
}
