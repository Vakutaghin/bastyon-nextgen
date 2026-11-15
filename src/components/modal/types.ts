import type { VNodeChild } from 'vue'

export interface ModalButtonProps {
  disabled?: boolean
  danger?: boolean
  loading?: boolean
}

export interface ModalProps {
  /** Открыто ли окно: `v-model:open` (или `v-model` у старых потребителей). */
  open?: boolean
  modelValue?: boolean
  /** Заголовок; можно и слотом `#title`. */
  title?: string
  /** Ширина: число — пиксели. По умолчанию 520, как у antd. */
  width?: string | number
  /** Почти на всю ширину — до ширины колонки ленты. */
  fullWidth?: boolean
  /** По центру экрана; иначе 100px от верха, как у antd. */
  centered?: boolean
  /** Крестик в углу. По умолчанию есть. */
  closable?: boolean
  /** Нажатие по маске закрывает. По умолчанию да. */
  maskClosable?: boolean
  /** Esc закрывает. По умолчанию да. */
  keyboard?: boolean
  /** Содержимое снимается после закрытия; по умолчанию остаётся (как у antd). */
  destroyOnClose?: boolean
  /** Футер: `null` — без футера; без пропа — слот `#footer` или штатный. */
  footer?: VNodeChild
  /** Штатный футер (Отмена / ОК) появляется, если задан `okText` или `@ok`. */
  okText?: string
  cancelText?: string
  okType?: 'primary' | 'danger'
  okButtonProps?: ModalButtonProps
  cancelButtonProps?: ModalButtonProps
  /** Кнопка ОК крутится. */
  confirmLoading?: boolean
  onOk?: (e: MouseEvent) => void
  /** Класс обёртки окна во весь экран (для правил родителя). */
  wrapClass?: string
  /** То же, имя antd. */
  wrapClassName?: string
  /** «Назад» на Android окно не закрывает (сворачивает приложение). */
  ignoreBack?: boolean
}

export interface ModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'update:modelValue', value: boolean): void
  (e: 'cancel'): void
  (e: 'afterClose'): void
}
