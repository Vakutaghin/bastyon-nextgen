export interface SignInModalProps {
  open?: boolean
}

export interface SignInModalEmits {
  (e: 'update:open', value: boolean): void
  (e: 'success'): void
  (e: 'cancel'): void
  (e: 'openRegister'): void
}
