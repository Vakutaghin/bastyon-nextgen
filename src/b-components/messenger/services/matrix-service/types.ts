/**
 * Узкие типы клиента matrix-js-sdk — мы используем меньше 10% его API,
 * полные типы (5к+ строк) импортировать не хочется. Тут описаны только
 * методы, которые трогает `MatrixService` и медиа-сендеры.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MatrixEventContent = Record<string, any>

export interface MatrixClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent: (roomId: string, type: string, content: MatrixEventContent) => Promise<any>
  uploadContent: (
    file: Blob | File,
    opts: {
      name?: string
      type?: string
      progressCallback?: (info: { loaded: number; total?: number }) => void
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>
  mxcUrlToHttp?: (mxcUrl: string) => string | null
}

export interface SecretsBlock {
  keys: string
  block: number
  v?: number
  version?: number
}
