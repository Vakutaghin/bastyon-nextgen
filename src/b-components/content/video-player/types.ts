// Типы видеоплеера

import type { HotkeyAction } from './video-hotkeys'

/** Уровень качества видеопотока */
export interface QualityLevel {
  /** Индекс уровня в HLS (-1 = авто) */
  index: number
  /** Высота видео (720, 1080, ...) */
  height: number
  /** Ширина видео */
  width?: number
  /** Битрейт (бит/с) */
  bitrate?: number
  /** Человекочитаемая метка ("720p", "1080p", "Авто") */
  label: string
}

/** Соотношение сторон видео/превью */
export interface AspectRatio {
  width: number
  height: number
  /** Использовать object-fit: contain вместо cover */
  useContain: boolean
}

/** Элемент списка горячих клавиш */
export interface HotkeyItem {
  /** Отображаемое название клавиши/комбинации */
  key: string
  /** Ключ i18n для описания действия */
  labelKey: string
}

/**
 * Плеер в video-player-manager: `pause` / `isPlaying` — для правила «играет
 * только один», остальное — чтобы менеджер выбрал, какому плееру достаётся
 * горячая клавиша, и отдал её ему.
 */
export interface VideoPlayerInstance {
  id: string
  pause: () => void
  isPlaying: () => boolean
  /** Корень плеера: по нему видно, в каком плеере фокус и виден ли он. */
  element: () => HTMLElement | null
  /** Ролик уже запускали (плеер инициализирован). */
  isStarted: () => boolean
  isHovered: () => boolean
  isFullscreen: () => boolean
  /** Плеером пользуются мышью или пальцем, а не с Tab. */
  isPointerMode: () => boolean
  /** Выполняет действие клавиши; `false` — клавиша не плеера, пусть работает как обычно. */
  handleHotkey: (action: HotkeyAction) => boolean
}
