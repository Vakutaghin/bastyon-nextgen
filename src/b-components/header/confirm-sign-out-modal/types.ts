export interface ConfirmSignOutModalProps {
  open?: boolean
}

export interface ConfirmSignOutModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}
