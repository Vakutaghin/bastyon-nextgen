export interface Props {
  open?: boolean
  /** Сид-фраза (12 слов). Есть только если вход/регистрация была по мнемонике. */
  mnemonic?: string
  /** Приватный ключ в hex. Передаётся, если нет сид-фразы (вход по ключу). Иначе вычисляется из сид-фразы в модалке. */
  privateKeyHex?: string
}

export interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}
