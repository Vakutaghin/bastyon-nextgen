/**
 * Преобразование `mxc://...` в HTTPS-URL медиа и проверка хоста медиа (S34).
 *
 * Медиа грузится только с homeserver'а: `client.mxcUrlToHttp()` (он собирает
 * URL на `client.baseUrl`) или ручная сборка `${baseUrl}/_matrix/media/v3/
 * download/{server}/{mediaId}` — homeserver сам федерирует чужой `server`.
 * Раньше fallback ходил на `https://{server}/…` напрямую, а абсолютные
 * `content.url`/`info.httpUrl` из контента отправителя брались как есть —
 * любой хост в сообщении получал IP читателя при открытии чата.
 *
 * См. CODE_AUDIT.md §1.
 */
import { getDefaultMatrixBaseUrl, getProductionMatrixBaseUrl } from './matrix-base-url'
import type { MatrixClient } from './types'

export type MediaResolverClient = Pick<MatrixClient, 'mxcUrlToHttp'> & { baseUrl?: string }

function originOf(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null
  } catch {
    return null
  }
}

/** Базовый URL homeserver'а: у клиента, иначе дефолтный. */
export function matrixBaseUrl(client: MediaResolverClient | null | undefined): string {
  const fromClient = typeof client?.baseUrl === 'string' ? client.baseUrl : ''
  return fromClient || getDefaultMatrixBaseUrl()
}

/** Origin'ы, с которых медиа можно грузить: homeserver клиента и прод-homeserver. */
export function trustedMediaOrigins(client: MediaResolverClient | null | undefined): string[] {
  const origins = new Set<string>()
  for (const base of [matrixBaseUrl(client), getProductionMatrixBaseUrl()]) {
    const o = originOf(base)
    if (o) origins.add(o)
  }
  return [...origins]
}

/** http(s)-URL медиа с доверенного origin (homeserver). Loopback сюда не попадает. */
export function isTrustedMediaUrl(
  client: MediaResolverClient | null | undefined,
  url: string
): boolean {
  const o = originOf(url)
  return !!o && trustedMediaOrigins(client).includes(o)
}

export function resolveMxcHttpUrl(
  client: MediaResolverClient | null | undefined,
  mxcUrl: string
): string | null {
  if (typeof mxcUrl !== 'string' || !mxcUrl.startsWith('mxc://')) return null

  try {
    if (client && typeof client.mxcUrlToHttp === 'function') {
      const candidate = client.mxcUrlToHttp(mxcUrl)
      // Доверяем только homeserver'у; loopback (127.0.0.1/localhost из старых
      // сборок SDK) и чужие хосты уходят в ручную сборку.
      if (typeof candidate === 'string' && isTrustedMediaUrl(client, candidate)) return candidate
    }
  } catch {
    // mxcUrlToHttp может отсутствовать в старых сборках matrix-js-sdk — fallback ниже.
  }

  const [server, mediaId] = mxcUrl.slice('mxc://'.length).split('/')
  if (!server || !mediaId) return null
  const base = matrixBaseUrl(client).replace(/\/$/, '')
  return `${base}/_matrix/media/v3/download/${server}/${mediaId}`
}

const MEDIA_PATH =
  /^\/_matrix\/(?:media\/(?:r0|v1|v3)|client\/v1\/media)\/(?:download|thumbnail)\/([A-Za-z0-9.:[\]-]+)\/([A-Za-z0-9_-]+)(?:\/|$)/

/**
 * http(s)-ссылка на медиа Matrix → `mxc://{server}/{mediaId}`. Такие ссылки
 * кладут в content bastyon-chat и forta.chat (`mxcUrlToHttp` при отправке), и
 * хост в них — тот, через который подключился отправитель: зеркало
 * `matrix.2.pocketnet.app` или loopback старых сборок SDK.
 */
export function mediaUrlToMxc(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const m = MEDIA_PATH.exec(u.pathname)
  return m ? `mxc://${m[1]}/${m[2]}` : null
}

/**
 * URL медиа из контента отправителя → URL для загрузки. `mxc://` и ссылки
 * homeserver'а — как есть; ссылку на медиа Matrix с другого хоста качаем через
 * свой homeserver; остальное — '' (медиа «недоступно», S34).
 */
export function resolveMediaUrl(
  client: MediaResolverClient | null | undefined,
  mxcOrHttp: string
): string {
  if (mxcOrHttp.startsWith('mxc://')) return resolveMxcHttpUrl(client, mxcOrHttp) || ''
  if (isTrustedMediaUrl(client, mxcOrHttp)) return mxcOrHttp
  const mxc = mediaUrlToMxc(mxcOrHttp)
  return mxc ? resolveMxcHttpUrl(client, mxc) || '' : ''
}
