/**
 * Последние ошибки приложения — для сведений, которые человек отправляет в
 * поддержку (messenger/support-report). Всё, что ушло в `console.error`:
 * неотловленные ошибки (polyfills, use-error-boundary) и ошибки модулей.
 *
 * Только в памяти и только до перезапуска. Адреса, идентификаторы чатов,
 * ключи, хэши, почта, IP и имя пользователя в путях вырезаются при записи.
 */

export interface RecentError {
  /** Когда случилась впервые подряд (ISO). */
  at: string
  /** Сколько раз подряд повторилась. */
  count: number
  message: string
}

const MAX_ERRORS = 20
const MAX_MESSAGE = 300
/** Дальше этого сырой текст не читаем: регулярки по мегабайту на каждую ошибку не гоняем. */
const MAX_RAW = 600

const errors: RecentError[] = []

/** [шаблон, замена]; порядок важен: почта до matrix-id, URL до длинных токенов. */
const SCRUB_RULES: [RegExp, string][] = [
  // Параметры и якорь ссылки — там бывают токены и адреса.
  [/(https?:\/\/[^\s?#'"]+)[?#][^\s'")]*/g, '$1?…'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>'],
  // Matrix: пользователь, комната, событие.
  [/@[\w.=\-/]+:[\w.-]+(:\d+)?/g, '<user>'],
  [/![\w-]+:[\w.-]+(:\d+)?/g, '<room>'],
  [/\$[\w+/-]{20,}(:[\w.-]+)?/g, '<event>'],
  // Имя пользователя в путях к файлам.
  [/(\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\\/\s'"]+/gi, '$1<user>'],
  // Адрес Pocketnet (основная и тестовая сеть).
  [/\b[PT][1-9A-HJ-NP-Za-km-z]{33}\b/g, '<address>'],
  [/\b[0-9a-fA-F]{32,}\b/g, '<hex>'],
  [/[A-Za-z0-9+/=_-]{40,}/g, '<data>'],
  [/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>'],
  // Двенадцать и больше слов подряд — похоже на фразу восстановления.
  [/\b(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}\b/g, '<words>'],
]

export function scrubForReport(text: string): string {
  let out = text
  for (const [re, replacement] of SCRUB_RULES) out = out.replace(re, replacement)
  return out
}

/** Обрезает по последнему пробелу: половина адреса не узнается и прошла бы мимо фильтра. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.search(/\s\S*$/)
  return space > 0 ? cut.slice(0, space) : ''
}

function describe(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`
  if (arg === null || arg === undefined) return String(arg)
  if (typeof arg !== 'object') return String(arg)
  const message = (arg as { message?: unknown }).message
  return typeof message === 'string' ? message : '[object]'
}

export function rememberError(args: readonly unknown[], now: Date = new Date()): void {
  const raw = cutAtWord(args.map(describe).join(' ').trim(), MAX_RAW)
  if (!raw) return
  let message = scrubForReport(raw)
  if (message.length > MAX_MESSAGE) message = `${cutAtWord(message, MAX_MESSAGE)}…`
  const last = errors[errors.length - 1]
  if (last?.message === message) {
    last.count++
    return
  }
  errors.push({ at: now.toISOString(), count: 1, message })
  if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS)
}

export function recentErrors(): RecentError[] {
  return errors.map((e) => ({ ...e }))
}

export function clearRecentErrors(): void {
  errors.length = 0
}

let installed = false

/** Запоминать всё, что уходит в `console.error`. Вызывается один раз при старте. */
export function captureConsoleErrors(): void {
  if (installed || typeof console === 'undefined') return
  installed = true
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      rememberError(args)
    } catch {
      /* сбор сведений не должен ломать сам лог */
    }
    original(...args)
  }
}
