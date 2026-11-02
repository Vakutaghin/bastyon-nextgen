/**
 * Картинки при включённом Tor на компьютере — через Tor, а не заглушкой.
 *
 * Окно приложения ходит в сеть само, мимо Tor, поэтому удалённые картинки
 * ему запрещены (CSP, tor-media-policy). Раньше вместо них были пустые места:
 * аватары — инициалы, картинки постов — по нажатию, превью видео — никак.
 * Теперь адрес картинки заменяется на свою схему `bastyon-tor` — её отдаёт
 * Rust, забрав картинку через Tor (src-tauri/src/tor/media.rs). Пока Tor не
 * готов, схема отвечает ошибкой: напрямую картинка не пойдёт.
 *
 * Компоненты, которые сами решают, что показать (аватар, TorImage), берут
 * адрес у `torMediaUrl`; остальные `<img>` и обложки `<video>` переписывает
 * наблюдатель за документом (`startTorMediaProxy`) — так их не нужно трогать
 * по одному. Сами ролики и фреймы по-прежнему не грузятся.
 */

export const TOR_MEDIA_SCHEME = 'bastyon-tor'

interface TauriInternals {
  convertFileSrc?: (path: string, protocol: string) => string
}

/** Удалённый адрес, который надо брать через Tor: http(s), не своё окно. */
export function isRemoteMediaUrl(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false
  try {
    const host = new URL(url).hostname
    return host !== 'localhost' && !host.endsWith('.localhost')
  } catch {
    return false
  }
}

/** Адрес картинки через Tor; не удалённый (data:, blob:, свои файлы) — как есть. */
export function torMediaUrl(url: string): string {
  if (!isRemoteMediaUrl(url)) return url
  const internals = (globalThis as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__
  if (internals?.convertFileSrc) return internals.convertFileSrc(url, TOR_MEDIA_SCHEME)
  const path = encodeURIComponent(url)
  return /Windows/i.test(globalThis.navigator?.userAgent ?? '')
    ? `http://${TOR_MEDIA_SCHEME}.localhost/${path}`
    : `${TOR_MEDIA_SCHEME}://localhost/${path}`
}

/** `srcset`: каждый адрес через Tor, дескрипторы (`2x`, `640w`) на месте. */
export function torMediaSrcset(srcset: string): string {
  return srcset
    .split(',')
    .map((part) => {
      const [url = '', ...rest] = part.trim().split(/\s+/)
      return [torMediaUrl(url), ...rest].join(' ')
    })
    .join(', ')
}

function rewrite(el: Element): void {
  if (el instanceof HTMLImageElement) {
    const src = el.getAttribute('src')
    if (isRemoteMediaUrl(src)) el.setAttribute('src', torMediaUrl(src))
    const srcset = el.getAttribute('srcset')
    if (srcset && /https?:\/\//i.test(srcset)) el.setAttribute('srcset', torMediaSrcset(srcset))
  } else if (el instanceof HTMLVideoElement) {
    const poster = el.getAttribute('poster')
    if (isRemoteMediaUrl(poster)) el.setAttribute('poster', torMediaUrl(poster))
  }
}

function rewriteTree(root: Element): void {
  rewrite(root)
  root.querySelectorAll('img, video').forEach(rewrite)
}

let stop: (() => void) | null = null

/**
 * Переписывает удалённые адреса `<img>` и обложек `<video>` на схему Tor —
 * уже стоящие в документе и все новые. Повторный вызов ничего не добавляет.
 * Наблюдатель срабатывает до того, как окно начнёт грузить картинку
 * (микрозадача после вставки), поэтому прямого запроса не бывает — его бы и
 * так не пустил CSP.
 */
export function startTorMediaProxy(doc: Document | undefined = globalDocument()): () => void {
  if (stop) return stop
  if (!doc?.documentElement || typeof MutationObserver === 'undefined') return () => {}
  rewriteTree(doc.documentElement)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        rewrite(record.target as Element)
      } else {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) rewriteTree(node as Element)
        })
      }
    }
  })
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'poster'],
  })
  stop = () => {
    observer.disconnect()
    stop = null
  }
  return stop
}

/**
 * Tor подключился: картинки, которые просили раньше и получили отказ
 * («Tor не готов»), — ещё раз.
 */
export function retryTorMedia(doc: Document | undefined = globalDocument()): void {
  doc?.querySelectorAll<HTMLImageElement>(`img[src*="${TOR_MEDIA_SCHEME}"]`).forEach((img) => {
    if (img.complete && img.naturalWidth === 0) {
      const src = img.src
      img.removeAttribute('src')
      img.setAttribute('src', src)
    }
  })
}

function globalDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document
}
