import { computed, type CSSProperties, type Slots } from 'vue'
import { Modal } from 'ant-design-vue'
import { SC_Modal } from './styled'
import { definedProps } from '../forward-props'
import type { ModalProps, ModalEmits } from './types'

export function useModal(p: ModalProps, emit: ModalEmits, slots: Slots) {
  // Объявленные пропсы (title/centered/destroyOnClose/okText/onOk/…) в antd —
  // см. forward-props.ts. Исключены те, что обёртка обрабатывает сама.
  const forwarded = computed<Record<string, unknown>>(() =>
    definedProps(p, [
      'modelValue',
      'open',
      'width',
      'fullWidth',
      'closable',
      'maskClosable',
      'footer',
      'onCancel',
    ])
  )

  // Футер: явный проп (в т.ч. `null` — без футера) → слот потребителя → без
  // футера. Дефолтные кнопки antd (OK/Cancel) обёртка не показывает никогда:
  // ни одна модалка проекта на них не рассчитывает, а раньше пустой слот
  // #footer их и так подавлял.
  const footer = computed(() =>
    p.footer !== undefined ? p.footer : slots.footer ? undefined : null
  )

  const isOpen = computed({
    get: () => {
      return p.open !== undefined ? p.open : p.modelValue !== undefined ? p.modelValue : false
    },
    set: (value: boolean) => {
      emit('update:open', value)
      emit('update:modelValue', value)
    },
  })

  const handleUpdateOpen = (value: boolean) => {
    isOpen.value = value
  }

  const handleCancel = () => {
    isOpen.value = false
    // emit('cancel') сам вызывает onCancel/@cancel родителя — явный p.onCancel()
    // здесь давал двойной вызов.
    emit('cancel')
  }

  const modalClass = computed(() => ({}))
  const wrapClassName = computed(() => 'bastyon-modal-wrap')

  // Пропсы объявлены в ModalProps, но раньше не прокидывались в AModal — из-за
  // этого `:closable="false"` / `:maskClosable="false"` не работали (крестик и
  // клик по маске оставались активны). Прокидываем явно; `undefined` оставляет
  // дефолт ant (true), поэтому существующие модалки не меняют поведение.
  const closable = computed(() => p.closable)
  const maskClosable = computed(() => p.maskClosable)

  // «Во всю ширину» — до ширины колонки ленты: на широком экране 95vw давали
  // строки по 200 символов, читать такое трудно.
  const width = computed(() => (p.fullWidth ? 'min(95vw, 880px)' : p.width))

  const bodyStyle = computed<CSSProperties>(() => ({
    maxHeight: '90vh',
    overflowY: 'auto',
  }))

  return {
    Modal,
    SC_Modal,
    isOpen,
    forwarded,
    footer,
    modalClass,
    wrapClassName,
    width,
    bodyStyle,
    closable,
    maskClosable,
    handleUpdateOpen,
    handleCancel,
  }
}
