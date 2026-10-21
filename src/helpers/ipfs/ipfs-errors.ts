// Ошибки проверенного скачивания в браузере. Отдельно от ipfs-verify.ts, чтобы
// сценарий клика мог различать их, не затягивая в основной бандл узел IPFS и
// библиотеки IPLD (они грузятся только при открытии ссылки).

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
 * Содержимое не пришло: в сети не нашлось, кто его раздаёт, или источник
 * замолчал. Это не порча данных, и пользователю нужно другое сообщение.
 */
export class TransportError extends Error {
  readonly reason: 'timeout' | 'network'

  constructor(reason: 'timeout' | 'network', message: string) {
    super(message)
    this.name = 'TransportError'
    this.reason = reason
  }
}

/** Имя IPNS или DNSLink не разрешилось в адрес содержимого. */
export class NameError extends Error {
  /** not-found — записи в сети нет; invalid — запись есть, но подпись не сошлась. */
  readonly reason: 'not-found' | 'invalid'

  constructor(reason: 'not-found' | 'invalid', message: string) {
    super(message)
    this.name = 'NameError'
    this.reason = reason
  }
}

/** Узел IPFS в этом браузере не запустился: старый движок или нет нужных сетевых API. */
export class NodeUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NodeUnavailableError'
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
