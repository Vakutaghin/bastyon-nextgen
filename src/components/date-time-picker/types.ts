export interface DateTimePickerProps {
  /** Выбранный момент, unix-секунды; 0 — не выбран. */
  value: number
  /** Только будущее: раньше следующей минуты (на момент открытия) выбрать нельзя. */
  future?: boolean
  /** Самый ранний день, который можно выбрать (unix-секунды любого момента дня). */
  min?: number
  /** Самый поздний день, который можно выбрать. */
  max?: number
  /** День и время (по умолчанию) или только день — тогда день выбирается сразу. */
  showTime?: boolean
  /** Крестик очистки при наведении (по умолчанию — есть). */
  allowClear?: boolean
  /** «Сегодня» под календарём без времени (по умолчанию — есть). */
  showToday?: boolean
  /** large — 36px, как поля в формах (по умолчанию); middle — 32px. */
  size?: 'large' | 'middle'
  placeholder?: string
  /** id поля — для `<label for>`. */
  id?: string
  disabled?: boolean
}

export interface DateTimePickerEmits {
  /** Выбранный момент в unix-секундах (без времени — начало дня); 0 — поле очистили. */
  (e: 'change', value: number): void
}
