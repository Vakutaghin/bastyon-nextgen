// Типы видеоплеера

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
  /** Описание действия */
  description: string
}

/** Интерфейс плеера для регистрации в video-player-manager */
export interface PlayerInstance {
  id: string
  pause: () => void
  isPlaying: () => boolean
  togglePlay: () => void
  toggleMute: () => void
  increasePlaybackRate: () => void
  decreasePlaybackRate: () => void
  resetPlaybackRate: () => void
  toggleHotkeysHelp: () => void
}
