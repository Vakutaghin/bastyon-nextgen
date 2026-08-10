// Универсальный вьювер (Фаза 1, Tier 0): чистая логика выбора «показать в окне vs
// скачать файл» для произвольного IPFS-контента. CID сам по себе НЕ несёт MIME —
// тип определяет gateway при извлечении, поэтому решение принимается по ответным
// заголовкам (Content-Type / Content-Disposition), ровно как это делает браузер.
//
// Здесь только pure-функции (без Tauri/сети) — они покрыты юнит-тестами. Сетевую
// пробу и запись на диск см. в ipfs-download.ts.
import type { IpfsTarget } from './ipfs-link'

/** ОС хоста — влияет только на PDF (WKWebView/WebView2 рендерят, WebKitGTK нет). */
export type ViewerOs = 'macos' | 'windows' | 'linux' | 'other'

export type RenderMode = 'render' | 'download'

// Content-Type семейства, которые webview показывает нативно.
const RENDERABLE_PREFIXES = ['text/', 'image/', 'audio/', 'video/'] as const
const RENDERABLE_EXACT = new Set(['application/json', 'application/xhtml+xml'])

/** `Content-Disposition: attachment` — сервер явно велит скачать. */
function isAttachment(contentDisposition: string | null | undefined): boolean {
  if (!contentDisposition) return false
  return /(^|;)\s*attachment\b/i.test(contentDisposition)
}

/** MIME без параметров, в нижнем регистре: `text/html; charset=utf-8` → `text/html`. */
function normalizeType(contentType: string | null | undefined): string {
  if (!contentType) return ''
  return (contentType.split(';')[0] ?? '').trim().toLowerCase()
}

/**
 * Решение render-vs-download по заголовкам ответа gateway. Принцип — вести себя
 * как браузер: показываем то, что webview умеет; всё остальное скачиваем.
 */
export function classify(
  contentType: string | null | undefined,
  contentDisposition: string | null | undefined,
  os: ViewerOs
): RenderMode {
  // Явный attachment уважаем даже для рендеримых типов.
  if (isAttachment(contentDisposition)) return 'download'

  const type = normalizeType(contentType)

  // Пустой/отсутствующий тип: браузероподобно пробуем показать. Это безопаснее
  // скачивания — окно в худшем случае покажет то же, что и раньше, без потери
  // данных (в отличие от «сохранили index.html вместо сайта»).
  if (!type) return 'render'

  // PDF: рендерится в WKWebView (macOS) и WebView2 (Windows), но не в WebKitGTK (Linux).
  if (type === 'application/pdf') {
    return os === 'macos' || os === 'windows' ? 'render' : 'download'
  }

  if (RENDERABLE_EXACT.has(type)) return 'render'
  if (RENDERABLE_PREFIXES.some((p) => type.startsWith(p))) return 'render'

  // application/octet-stream, zip, x-tar, архивы, office, всё прочее.
  return 'download'
}

/** Определение ОС по userAgent (webview). Мобилка сюда не доходит — фича desktop-only. */
export function detectViewerOs(): ViewerOs {
  if (typeof navigator === 'undefined') return 'other'
  const ua = (navigator.userAgent || '').toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux') || ua.includes('x11')) return 'linux'
  return 'other'
}

/** Небезопасные для имени файла символы → `_`; пустое имя отфильтровано вызывающим. */
function sanitizeFilename(name: string): string {
  return (
    name
      // Разделители пути, wildcard-символы и управляющие символы (намеренно) → `_`.
      // eslint-disable-next-line no-control-regex
      .replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
      .replace(/^\.+/, '')
      .trim()
  )
}

/** Имя файла из `Content-Disposition` (`filename*=UTF-8''…` приоритетнее `filename="…"`). */
function filenameFromDisposition(contentDisposition: string | null | undefined): string {
  if (!contentDisposition) return ''
  // RFC 5987 extended form.
  const ext = /filename\*\s*=\s*(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition)
  if (ext?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(ext[1]))
    } catch {
      return sanitizeFilename(ext[1])
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition)
  if (plain?.[1]) return sanitizeFilename(plain[1])
  return ''
}

/**
 * Имя для сохраняемого файла: 1) из Content-Disposition, 2) последний сегмент пути
 * с расширением, 3) fallback `<root>.bin`.
 */
export function downloadFilename(
  target: IpfsTarget,
  contentDisposition: string | null | undefined
): string {
  const fromHeader = filenameFromDisposition(contentDisposition)
  if (fromHeader) return fromHeader

  const seg = target.path.split('/').filter(Boolean).pop()
  if (seg && seg.includes('.')) {
    const clean = sanitizeFilename(seg)
    if (clean) return clean
  }

  const root = sanitizeFilename(target.root).slice(0, 24)
  return `${root || 'ipfs'}.bin`
}
