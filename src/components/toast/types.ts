export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading'

/** Где стоят тосты: на компьютере — внизу слева, в каркасе телефона — сверху. */
export type ToastPlacement = 'top' | 'bottomLeft'

export interface ToastItem {
  /** Тост с тем же ключом обновляется на месте. */
  key: string
  type: ToastType
  message: string
  description?: string
  /** Секунды до закрытия; 0 — пока не закроют. */
  duration: number
  placement: ToastPlacement
  /** Крестик; у тоста загрузки его нет — его закрывает тот, кто открыл. */
  closable: boolean
  /** Нажатие на тост (например, переход в настройки). Сам тост не закрывает. */
  onClick?: () => void
}

/** Что передают при показе: ключ можно не задавать. */
export type ToastInput = Omit<ToastItem, 'key'> & { key?: string }
