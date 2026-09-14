/**
 * Базовый URL homeserver'а — без импорта matrix-js-sdk, чтобы резолвер медиа
 * и тесты не тянули SDK.
 */
import servers from '@/servers.json'

/** Прод-homeserver из конфигурации: `https://matrix.pocketnet.app`. */
export function getProductionMatrixBaseUrl(): string {
  const host = servers.servers?.production?.matrix ?? 'matrix.pocketnet.app'
  return host.startsWith('http') ? host : `https://${host}`
}

export function getDefaultMatrixBaseUrl(): string {
  const prodUrl = getProductionMatrixBaseUrl()
  if (!import.meta.env.DEV) return prodUrl
  // In Tauri tauriFetch isn't subject to CORS, so skip the Vite /_matrix proxy
  // and talk to the homeserver directly (which is also what's allowed by the HTTP scope).
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  return inTauri ? prodUrl : window.location.origin
}
