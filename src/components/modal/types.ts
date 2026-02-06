export interface ModalProps {
  modelValue?: boolean
  open?: boolean
  title?: string
  width?: string | number
  centered?: boolean
  closable?: boolean
  maskClosable?: boolean
  destroyOnClose?: boolean
  footer?: any
  okText?: string
  cancelText?: string
  okButtonProps?: any
  cancelButtonProps?: any
  onOk?: () => void
  onCancel?: () => void
}

export interface ModalEmits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:open', value: boolean): void
  (e: 'cancel'): void
}
