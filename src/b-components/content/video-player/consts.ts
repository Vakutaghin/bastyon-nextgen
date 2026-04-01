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

/** Список горячих клавиш для отображения в справке */
export const HOTKEYS_LIST: HotkeyItem[] = [
  { key: 'Space', description: 'Воспроизведение / Пауза' },
  { key: 'M', description: 'Включить / Выключить звук' },
  { key: 'F', description: 'На весь экран' },
  { key: 'Shift + >', description: 'Увеличить скорость' },
  { key: 'Shift + <', description: 'Уменьшить скорость' },
  { key: 'Shift + / (?)', description: 'Показать эту справку' },
  { key: '← / →', description: 'Перемотка на 10 сек' },
  { key: '↑ / ↓', description: 'Громкость' },
]
