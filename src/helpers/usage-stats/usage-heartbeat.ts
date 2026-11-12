/**
 * Анонимная статистика использования — отправка отметок (расчёты — в usage-beat).
 *
 * 15-минутка засчитывается, если в ней приложение было на экране и им
 * пользовались: запуск, возврат в приложение, касание, клавиша, прокрутка или
 * играющее видео. Окно, забытое на втором мониторе, часы использования не
 * набирает. Первое действие в новой 15-минутке шлёт отметку сразу, остальное
 * ловит проверка раз в минуту.
 *
 * Запрос идёт через `appFetch` — при включённом Tor через Tor — без куки и без
 * Referer: путь страницы (например, чей профиль открыт) в нём не уходит.
 * Сбой не повторяется отдельно: следующая минутная проверка попробует снова,
 * а флаги «первая за сутки» не теряются, пока отметка не дошла.
 *
 * Только в собранном приложении с адресом сервера (usage-stats-config): без
 * адреса, в dev-сервере, e2e и vitest отметок нет. Выключается настройкой
 * «Анонимная статистика» (app-preferences-store).
 */

import { watch } from 'vue'
import { appFetch } from '@/helpers/api/fetch-strategies'
import { isOfflineNow } from '@/helpers/api/offline'
import { CURRENT_APP_VERSION } from '@/helpers/changelog/changelog-loader'
import { isCapacitor, isTauri } from '@/b-components/video-uploader/utils/environment'
import { settingsAPI } from '@/db/apis/settings-api'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { logger } from '@/services/logger'
import {
  beatUrl,
  detectPlatform,
  nextBeat,
  parseBeatState,
  slotOf,
  type UsageBeatState,
  type UsagePlatform,
} from './usage-beat'
import { usageStatsUrl } from './usage-stats-config'

const log = logger.scope('[usage-stats]')

const STATE_KEY = 'usageBeatState'
const TICK_MS = 60_000
const REQUEST_TIMEOUT_MS = 10_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let started = false
let state: UsageBeatState | null = null
let lastActivityAt = 0
let sending = false
let timer: ReturnType<typeof setInterval> | null = null
let stopWatch: (() => void) | null = null

function currentPlatform(): UsagePlatform {
  const runtime = isTauri() ? 'desktop' : isCapacitor() ? 'mobile' : 'web'
  return detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent, runtime)
}

function mediaPlaying(): boolean {
  return Array.from(document.querySelectorAll<HTMLMediaElement>('video, audio')).some(
    (el) => !el.paused && !el.ended
  )
}

function inUse(now: number): boolean {
  if (document.visibilityState !== 'visible') return false
  return slotOf(lastActivityAt) === slotOf(now) || mediaPlaying()
}

async function send(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await appFetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    return res.ok
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Настройка прочитана с устройства и разрешает отметки. До чтения в сторе
 * значение по умолчанию — «включено», и выключивший статистику успел бы
 * отправить отметку при запуске.
 */
function allowed(): boolean {
  const prefs = useAppPreferencesStore()
  return prefs.loaded && prefs.usageStats
}

/** Отправить отметку, если пора. Возвращает, ушла ли она. */
export async function beatIfDue(now: number = Date.now()): Promise<boolean> {
  const base = usageStatsUrl()
  if (!base || sending || !allowed()) return false
  if (!inUse(now) || isOfflineNow()) return false
  const beat = nextBeat(state, now)
  if (!beat) return false

  sending = true
  try {
    const ok = await send(beatUrl(base, beat, CURRENT_APP_VERSION, currentPlatform()))
    if (!ok) return false
    state = beat.state
    await settingsAPI.set(STATE_KEY, state)
    return true
  } catch (e) {
    log.debug('beat failed', e)
    return false
  } finally {
    sending = false
  }
}

function onActivity(): void {
  const now = Date.now()
  const fresh = slotOf(now) !== slotOf(lastActivityAt)
  lastActivityAt = now
  if (fresh) void beatIfDue(now)
}

function onVisibility(): void {
  // Вернуться в приложение — тоже использование.
  if (document.visibilityState !== 'visible') return
  lastActivityAt = Date.now()
  void beatIfDue(lastActivityAt)
}

/**
 * Запустить отметки. Запуск приложения — уже использование, поэтому первая
 * уходит сразу. Повторный вызов ничего не делает.
 */
export async function runUsageHeartbeat(): Promise<void> {
  if (started || typeof document === 'undefined') return
  started = true
  lastActivityAt = Date.now()
  try {
    state = parseBeatState(await settingsAPI.get(STATE_KEY))
  } catch {
    state = null
  }

  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, onActivity, { capture: true, passive: true })
  }
  document.addEventListener('visibilitychange', onVisibility)
  timer = setInterval(() => void beatIfDue(), TICK_MS)
  // Настройки прочитались или статистику включили — отметка за эту
  // 15-минутку уходит сразу.
  stopWatch = watch(allowed, (on) => {
    if (on) void beatIfDue()
  })
  void beatIfDue()
}

/** Точка входа из main.ts: в dev-сборке и без адреса сервера ничего не делает. */
export function startUsageHeartbeat(): void {
  if (!import.meta.env.PROD || !usageStatsUrl()) return
  void runUsageHeartbeat()
}

/** Сброс для тестов. */
export function resetUsageHeartbeatForTests(): void {
  if (timer) clearInterval(timer)
  timer = null
  stopWatch?.()
  stopWatch = null
  for (const type of ACTIVITY_EVENTS) {
    window.removeEventListener(type, onActivity, { capture: true })
  }
  document.removeEventListener('visibilitychange', onVisibility)
  started = false
  state = null
  lastActivityAt = 0
  sending = false
}
