/**
 * Политика медиа при включённом Tor (V21, решение Р1 — вариант B).
 *
 * Через Tor ходит только то, что идёт через `appFetch`/`torFetch`: RPC, чат,
 * API. `<img>`, `<video>`, `<iframe>` webview грузит сам — мимо Tor, с реальным
 * IP. Прокси webview (`proxy_url`) не настроен, поэтому честный вариант:
 * платформенно запретить автоматические загрузки картинок и фреймов через
 * CSP, а нужное грузить по клику через `torFetch` (`TorImage`).
 *
 * Meta-CSP применяется с момента вставки и не снимается до перезагрузки
 * документа — отключение Tor перезагружает приложение (см. tor-store).
 */

export const TOR_MEDIA_META_ID = 'tor-media-policy'

/** Класс на `<html>` — CSS прячет заблокированные `<img>` вместо «битой» иконки. */
export const TOR_MEDIA_CLASS = 'tor-media-blocked'

/**
 * `'self'` — tauri://localhost / http://tauri.localhost; `asset:` — превью
 * транскодера через convertFileSrc; `blob:`/`data:` — TorImage, QR, локальные
 * файлы. Фреймы: только свои — YouTube, превью композера и мини-аппы под Tor
 * отключены и на уровне компонентов.
 */
export const TOR_MEDIA_CSP =
  "img-src 'self' data: blob: asset: https://asset.localhost http://asset.localhost; " +
  "frame-src 'self'"

export function isTorMediaPolicyApplied(doc: Document | undefined = globalDocument()): boolean {
  return !!doc?.getElementById(TOR_MEDIA_META_ID)
}

/** Идемпотентно: второй вызов ничего не добавляет. */
export function applyTorMediaPolicy(doc: Document | undefined = globalDocument()): void {
  if (!doc || isTorMediaPolicyApplied(doc)) return
  const meta = doc.createElement('meta')
  meta.id = TOR_MEDIA_META_ID
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = TOR_MEDIA_CSP
  doc.head.appendChild(meta)
  doc.documentElement.classList.add(TOR_MEDIA_CLASS)
}

function globalDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document
}
