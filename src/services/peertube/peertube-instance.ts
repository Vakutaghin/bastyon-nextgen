/**
 * Низкоуровневый транспорт к конкретному PeerTube-инстансу.
 *
 * ВАЖНО (см. VIDEO_UPLOAD_CHECKLIST §1): загрузка/авторизация видео идут НАПРЯМУЮ
 * браузер → инстанс (не через ноду). Нода отдаёт только выбор хоста + чтение.
 * Весь трафик обязан идти через appFetch (Tor / Tauri plugin-http / dev vite-proxy),
 * а не через raw fetch — иначе ломается Tor и cross-origin CORS.
 */

import { appFetch } from '@/helpers/api/request'

/** fetch, уже привязанный к конкретному host: (path, init) → Response. DI-точка для тестов. */
export type InstanceFetch = (path: string, init?: RequestInit) => Promise<Response>

/** В dev-браузере ходим через vite-прокси `/api/peertube/...`, чтобы обойти CORS. */
const isDevBrowser = (): boolean =>
  typeof import.meta !== 'undefined' &&
  import.meta.env?.DEV === true &&
  typeof window !== 'undefined'

/**
 * Строит URL к эндпоинту инстанса. `path` — без ведущего слэша, напр.
 * 'api/v1/oauth-clients/local'. dev → same-origin vite-proxy, prod → прямой https.
 */
export function peertubeInstanceUrl(host: string, path: string): string {
  const clean = path.replace(/^\/+/, '')
  return isDevBrowser() ? `/api/peertube/${host}/${clean}` : `https://${host}/${clean}`
}

/**
 * x-www-form-urlencoded сериализация плоского объекта — 1-в-1 с legacy `serialize`
 * (`encodeURIComponent(k)=encodeURIComponent(v)`, склейка через `&`). Пропускает
 * undefined/null. Требуется для blockChainAuth и users/token.
 */
export function serializeForm(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((k) => data[k] !== undefined && data[k] !== null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(data[k]))}`)
    .join('&')
}

/** fetch к инстансу host по относительному path, через appFetch (обязательный транспорт). */
export function peertubeInstanceFetch(
  host: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return appFetch(peertubeInstanceUrl(host, path), init)
}
