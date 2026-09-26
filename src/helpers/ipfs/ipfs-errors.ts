// Ошибки проверенного скачивания в браузере. Отдельно от ipfs-verify.ts, чтобы
// сценарий клика мог различать их, не затягивая в основной бандл библиотеки
// IPLD (они грузятся только при скачивании).

export type VerifyCode =
  | 'mismatch'
  | 'unsupported'
  | 'missing'
  | 'not-found'
  | 'directory'
  | 'malformed'
  | 'too-large'

/** Текст — как у Rust (`verify-<код>: …`), коды те же. */
export class VerifyError extends Error {
  readonly code: VerifyCode

  constructor(code: VerifyCode, detail?: string) {
    super(detail ? `verify-${code}: ${detail}` : `verify-${code}`)
    this.name = 'VerifyError'
    this.code = code
  }
}

/**
 * Сбой связи со шлюзом (обрыв, долгая тишина). Слой проверки пропускает его
 * как есть: это не порча данных, и пользователю нужно другое сообщение.
 */
export class TransportError extends Error {
  readonly reason: 'timeout' | 'network'

  constructor(reason: 'timeout' | 'network', message: string) {
    super(message)
    this.name = 'TransportError'
    this.reason = reason
  }
}

/** Шлюз ответил ошибкой: 429 — перегружен, 5xx — не нашёл файл в сети. */
export class GatewayError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`gateway responded ${status}`)
    this.name = 'GatewayError'
    this.status = status
  }
}

/** Ключ приватной ссылки не подошёл или шифртекст повреждён. */
export class SecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretError'
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}
