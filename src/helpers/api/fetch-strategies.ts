/**
 * Стратегии fetch'а в зависимости от окружения и URL:
 * - Same-origin → browser fetch (Vite dev proxy продолжает работать)
 * - Tor включён → torFetch через Tauri-команду
 * - Tauri → plugin-http (CORS bypass)
 * - Browser → globalThis.fetch
 *
 * `matrixFetch` — тонкий alias на `appFetch` для семантической маркировки
 * запросов Matrix/chat (на случай если в будущем понадобится особое поведение).
 */

import { getTauriFetch, isSameOriginUrl, shouldTorifyRequest, torFetch } from './request-tor'

export { getTauriFetch } from './request-tor'

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  // Vite dev proxy / same-origin: bypass plugin-http and Tor.
  if (isSameOriginUrl(url)) {
    return globalThis.fetch(input, init)
  }
  if (await shouldTorifyRequest()) {
    return torFetch(input, init)
  }
  const tauriF = await getTauriFetch()
  return (tauriF ?? globalThis.fetch)(input, init)
}

/** Fetch for Matrix/chat: routes через Tor когда включён, plugin-http для cross-origin
 *  (CORS bypass), plain browser fetch для same-origin (Vite dev proxy). */
export async function matrixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return appFetch(input, init)
}
