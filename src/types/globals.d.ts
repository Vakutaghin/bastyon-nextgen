/**
 * Build-time constants injected via vite.config.js `define`.
 */
declare const __APP_VERSION__: string

/**
 * Tauri injects these globals at runtime. Declared as optional `unknown`
 * so feature-detection (`typeof window.__TAURI__`) is type-safe without `any`.
 */
interface Window {
  __TAURI__?: unknown
  __TAURI_INTERNALS__?: unknown
  __TAURI_METADATA__?: unknown
}
