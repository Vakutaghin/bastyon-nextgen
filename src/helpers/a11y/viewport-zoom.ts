/**
 * Увеличение страницы щипком на сайте в браузере телефона (WCAG 1.4.4).
 *
 * В index.html масштаб запрещён (`maximum-scale=1, user-scalable=no`), и так
 * и остаётся там, где это нужно:
 * - в приложении для Android (Capacitor) и на компьютере (Tauri) — интерфейс
 *   ведёт себя как приложение, а размер текста там меняют системная настройка
 *   шрифта Android (WebView её учитывает) и «Масштаб интерфейса» в настройках;
 * - в Safari на iPhone и iPad: без `maximum-scale` он сам увеличивает
 *   страницу при фокусе в поле с мелким шрифтом, а щипок там работает и так —
 *   запрет `user-scalable=no` Safari с iOS 10 не соблюдает.
 *
 * В остальных браузерах телефона (Chrome на Android и др.) запрет снимается.
 */

export interface ZoomEnv {
  native: boolean
  ios: boolean
}

export const ZOOMABLE_VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

export function isIosBrowser(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
  if (/iP(hone|ad|od)/.test(nav.userAgent)) return true
  // iPadOS притворяется Маком, но у него есть касания.
  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1
}

/** Снять запрет масштаба, если можно; true — сняли. */
export function allowPinchZoom(env: ZoomEnv, doc: Document = document): boolean {
  if (env.native || env.ios) return false
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return false
  meta.setAttribute('content', ZOOMABLE_VIEWPORT)
  return true
}
