export interface ConfirmShowMnemonicModalProps {
  open?: boolean
}

export interface ConfirmShowMnemonicModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}
