// Константы видеоплеера

import type { HotkeyItem } from './types'

/** Шаг перемотки клавишами J и L (секунды) — как у YouTube */
export const SEEK_STEP = 10

/** Шаг перемотки стрелками (секунды) — как у YouTube */
export const SEEK_STEP_SHORT = 5

/** Шаг изменения громкости стрелками — 5 %, как у YouTube */
export const VOLUME_STEP = 0.05

/** Покадровый шаг запятой и точкой на паузе (секунды): кадр при 30 fps */
export const FRAME_STEP = 1 / 30

/**
 * Зажатая стрелка повторяет перемотку не чаще раза в столько мс, а не на
 * каждый автоповтор клавиатуры (~30 в секунду): каждая перемотка — это ещё и
 * новые запросы сегментов.
 */
export const SEEK_REPEAT_INTERVAL = 200

/** Зажатая стрелка вверх/вниз меняет громкость не чаще раза в столько мс */
export const VOLUME_REPEAT_INTERVAL = 100

/** Длительность показа уведомлений (мс) */
export const NOTIFICATION_DURATION = 500

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
  { key: 'Space / K', labelKey: 'hotkeys.playPause' },
  { key: '← / →', labelKey: 'hotkeys.seekShort' },
  { key: 'J / L', labelKey: 'hotkeys.seekLong' },
  { key: '0 … 9', labelKey: 'hotkeys.seekPercent' },
  { key: 'Home / End', labelKey: 'hotkeys.seekEdges' },
  { key: ', / .', labelKey: 'hotkeys.frame' },
  { key: '↑ / ↓', labelKey: 'hotkeys.volume' },
  { key: 'M', labelKey: 'hotkeys.toggleMute' },
  { key: 'F', labelKey: 'hotkeys.fullscreen' },
  { key: 'I', labelKey: 'hotkeys.pip' },
  { key: 'Shift + >', labelKey: 'hotkeys.speedUp' },
  { key: 'Shift + <', labelKey: 'hotkeys.speedDown' },
  { key: 'Shift + / (?)', labelKey: 'hotkeys.showHelp' },
]
