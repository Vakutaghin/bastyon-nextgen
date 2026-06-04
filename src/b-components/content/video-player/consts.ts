// Константы видеоплеера

import type { HotkeyItem } from './types'

/** Шаг перемотки при нажатии стрелок (секунды) */
export const SEEK_STEP = 10

/** Шаг изменения громкости при нажатии стрелок */
export const VOLUME_STEP = 0.1

/** Длительность показа уведомлений (мс) */
export const NOTIFICATION_DURATION = 500

/** Длительность показа уведомления скорости (мс) */
export const PLAYBACK_RATE_NOTIFICATION_DURATION = 1000

/** Длительность показа уведомления громкости (мс) */
export const VOLUME_NOTIFICATION_DURATION = 1000

/** Задержка для определения двойного клика (мс) */
export const DOUBLE_CLICK_DELAY = 200

/** Порог видимости для IntersectionObserver (0.5 = 50%) */
export const VISIBILITY_THRESHOLD = 0.5

/** Порог соотношения сторон для переключения contain/cover */
export const ASPECT_RATIO_CONTAIN_THRESHOLD = 1 / 1.5

/**
 * Watchdog начальной загрузки (мс). Если за это время плеер так и не инициализировался
 * (зависший манифест/сегмент, который не отдаёт даже ошибку) — показываем ошибку и кнопку
 * «Повторить», вместо вечного спиннера. Бюджет покрывает и retry hls.js, и mp4-fallback.
 */
export const VIDEO_LOAD_WATCHDOG_MS = 30000

/** Список горячих клавиш для отображения в справке */
export const HOTKEYS_LIST: HotkeyItem[] = [
  { key: 'Space', labelKey: 'hotkeys.playPause' },
  { key: 'M', labelKey: 'hotkeys.toggleMute' },
  { key: 'F', labelKey: 'hotkeys.fullscreen' },
  { key: 'Shift + >', labelKey: 'hotkeys.speedUp' },
  { key: 'Shift + <', labelKey: 'hotkeys.speedDown' },
  { key: 'Shift + / (?)', labelKey: 'hotkeys.showHelp' },
  { key: '← / →', labelKey: 'hotkeys.seek' },
  { key: '↑ / ↓', labelKey: 'hotkeys.volume' },
]
