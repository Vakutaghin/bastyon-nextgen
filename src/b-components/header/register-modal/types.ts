export interface Props {
  open?: boolean
}

export interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'success'): void
  (e: 'cancel'): void
  (e: 'openSignIn'): void
}
