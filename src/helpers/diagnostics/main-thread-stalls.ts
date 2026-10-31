/**
 * Долгие блокировки главного потока — для сведений, которые человек отправляет
 * в поддержку (messenger/support-report). «Листается, но ничего не нажимается»
 * на чужом телефоне не воспроизвести, а здесь видно, сколько стояло и чей код
 * держал поток (Long Animation Frames: Chromium 123+, Android WebView).
 *
 * В localStorage, а не в памяти, как ошибки: после такого зависания приложение
 * обычно перезапускают. Только длительности, имена файлов и функций кода —
 * ни страниц, ни данных.
 */

import { scrubForReport } from './recent-errors'

export interface MainThreadStall {
  /** Когда закончилась (ISO). */
  at: string
  /** Сколько длилась. */
  ms: number
  /** Сколько из неё поток не отвечал на ввод. */
  blockingMs?: number
  /** Через сколько секунд после запуска приложения. */
  uptimeS: number
  /** Приложение было свёрнуто. */
  hidden?: boolean
  /** Что держало поток: `файл:позиция функция мс`, самое долгое первым. */
  scripts?: string[]
  /** Не поток: маска нажатий сдалась — меню не закрывалось от нажатий мимо. */
  kind?: 'tap-shield'
  /** Для маски: классы кнопки меню, которое не закрывалось. */
  detail?: string
}

const STORAGE_KEY = 'BST_DIAG_STALLS'
const MAX_STALLS = 20
/** Короче — обычная заминка, а не «приложение не отвечает». */
const MIN_STALL_MS = 1000
const KEEP_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SCRIPTS = 3

interface ScriptTiming {
  duration: number
  invokerType?: string
  sourceURL?: string
  sourceFunctionName?: string
  sourceCharPosition?: number
}

interface FrameTiming {
  duration: number
  blockingDuration?: number
  scripts?: ScriptTiming[]
}

function read(): MainThreadStall[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as MainThreadStall[]) : []
  } catch {
    return []
  }
}

function write(stalls: MainThreadStall[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stalls))
  } catch {
    /* место кончилось или хранилище закрыто — сведения best-effort */
  }
}

/** Блокировки за последнюю неделю, по порядку. */
export function recentStalls(now: number = Date.now()): MainThreadStall[] {
  return read().filter((s) => now - Date.parse(s.at) < KEEP_MS)
}

export function noteStall(
  stall: Omit<MainThreadStall, 'at' | 'uptimeS'>,
  now: number = Date.now()
): void {
  const uptimeS = Math.round(performance.now() / 1000)
  const next = [...recentStalls(now), { at: new Date(now).toISOString(), uptimeS, ...stall }]
  write(next.slice(-MAX_STALLS))
}

/** `index-Bx9.js:48213 decryptEvent 2140ms` — файл без пути, функция или кто позвал. */
function describeScript(script: ScriptTiming): string {
  const file = (script.sourceURL ?? '').split(/[?#]/)[0]!.split('/').pop() || '?'
  const at =
    script.sourceCharPosition && script.sourceCharPosition > 0
      ? `:${script.sourceCharPosition}`
      : ''
  const fn = script.sourceFunctionName || script.invokerType || ''
  return scrubForReport(`${file}${at} ${fn} ${Math.round(script.duration)}ms`.replace(/\s+/g, ' '))
}

export function stallFromFrame(
  frame: FrameTiming,
  hidden: boolean
): Omit<MainThreadStall, 'at' | 'uptimeS'> {
  const scripts = [...(frame.scripts ?? [])]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, MAX_SCRIPTS)
    .map(describeScript)
  return {
    ms: Math.round(frame.duration),
    blockingMs:
      frame.blockingDuration !== undefined ? Math.round(frame.blockingDuration) : undefined,
    hidden: hidden || undefined,
    scripts: scripts.length ? scripts : undefined,
  }
}

let watching = false

/** Один раз на запуск. Без PerformanceObserver (старые движки) — молча ничего. */
export function watchMainThreadStalls(): void {
  if (watching || typeof PerformanceObserver === 'undefined') return
  const types = PerformanceObserver.supportedEntryTypes ?? []
  // Кадры с атрибуцией скриптов лучше; где их нет — длинные задачи без неё.
  const type = types.includes('long-animation-frame')
    ? 'long-animation-frame'
    : types.includes('longtask')
      ? 'longtask'
      : null
  if (!type) return
  watching = true
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as FrameTiming[]) {
        if (entry.duration < MIN_STALL_MS) continue
        noteStall(stallFromFrame(entry, document.visibilityState === 'hidden'))
      }
    }).observe({ type, buffered: true })
  } catch {
    watching = false
  }
}
