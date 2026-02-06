export interface RegistrationValidationModalProps {
  open?: boolean
  status?: string
}

export interface RegistrationValidationModalEmits {
  (e: 'update:open', value: boolean): void
}
