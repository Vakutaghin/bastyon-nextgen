/**
 * Преобразование `mxc://...` в публичный HTTPS-URL медиа-сервера.
 *
 * Предпочитаем `client.mxcUrlToHttp()`, отбрасываем loopback (`127.0.0.1`/`localhost`),
 * fallback на ручную сборку `https://{server}/_matrix/media/v3/download/{server}/{mediaId}`.
 *
 * См. CODE_AUDIT.md §1.
 */
import type { MatrixClient } from './types'

export function resolveMxcHttpUrl(
  client: Pick<MatrixClient, 'mxcUrlToHttp'> | null | undefined,
  mxcUrl: string
): string | null {
  let httpUrl: string | null = null
  try {
    if (client && typeof client.mxcUrlToHttp === 'function' && mxcUrl) {
      const candidate = client.mxcUrlToHttp(mxcUrl)
      const isLoopback =
        typeof candidate === 'string' &&
        (candidate.includes('://127.0.0.1') || candidate.includes('://localhost'))
      if (!isLoopback) httpUrl = candidate
    }
  } catch {
    // mxcUrlToHttp может отсутствовать в старых сборках matrix-js-sdk — fallback ниже.
  }

  if (!httpUrl && typeof mxcUrl === 'string' && mxcUrl.startsWith('mxc://')) {
    try {
      const t = mxcUrl.replace('mxc://', '').split('/')
      const server = t[0]
      const mediaId = t[1]
      if (server && mediaId) {
        httpUrl = `https://${server}/_matrix/media/v3/download/${server}/${mediaId}`
      }
    } catch {
      // некорректный mxc URL — вернём null.
    }
  }
  return httpUrl
}
