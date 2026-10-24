/**
 * Стратегии fetch'а в зависимости от окружения и URL:
 * - Same-origin → browser fetch (Vite dev proxy продолжает работать)
 * - Tor включён → torFetch через Tauri-команду; пока Tor не готов — ждём,
 *   при `failed` — `TorNotReadyError`. Прямого соединения при включённом Tor
 *   нет (V20, fail-closed).
 * - Tauri → plugin-http (CORS bypass)
 * - Browser → globalThis.fetch
 *
 * `matrixFetch` — запросы Matrix/chat: то же, а в приложении Android
 * JSON-API сервера чатов идёт нативным HTTP Capacitor (`request-native.ts`).
 */

import { TorNotReadyError, torRoutingMode, waitForTorRouting } from '@/helpers/tor/tor-gate'
import { getTauriFetch, isSameOriginUrl, torFetch } from './request-tor'
import { isNativeMatrixRequest, nativeFetch } from './request-native'

export { getTauriFetch } from './request-tor'

export async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  // Vite dev proxy / same-origin: bypass plugin-http and Tor.
  if (isSameOriginUrl(url)) {
    return globalThis.fetch(input, init)
  }

  let mode = await torRoutingMode()
  if (mode === 'wait') {
    // Установка/бутстрап: запрос ждёт готовности, а не уходит напрямую.
    // Abort-сигнал вызывающего (таймаут RPC) прерывает ожидание.
    mode = await waitForTorRouting({ signal: init?.signal ?? undefined })
  }
  if (mode === 'failed') {
    throw new TorNotReadyError(
      'failed',
      `Tor is enabled but failed; refusing direct request to ${url}`
    )
  }
  if (mode === 'tor') {
    return torFetch(input, init)
  }
  const tauriF = await getTauriFetch()
  return (tauriF ?? globalThis.fetch)(input, init)
}

/** Fetch for Matrix/chat: routes через Tor когда включён, plugin-http для cross-origin
 *  (CORS bypass), plain browser fetch для same-origin (Vite dev proxy). На Android —
 *  нативный HTTP мимо CORS WebView, как plugin-http в Tauri; Tor там не бывает. */
export async function matrixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isNativeMatrixRequest(input, init)) return nativeFetch(input, init)
  return appFetch(input, init)
}
