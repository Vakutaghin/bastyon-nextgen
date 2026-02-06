export interface ConfirmDeleteModalProps {
  open?: boolean
}

export interface ConfirmDeleteModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}
