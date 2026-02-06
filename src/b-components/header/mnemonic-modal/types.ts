export interface Props {
  open?: boolean
  mnemonic?: string
}

export interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
  (e: 'dontShowAgain'): void
}
