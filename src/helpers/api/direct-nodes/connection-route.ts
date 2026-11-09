/**
 * Чем идут запросы к блокчейну: через прокси или напрямую к нодам.
 *
 * Настройка «Подключение к сети»:
 * - «Прокси» — как всегда;
 * - «Ноды напрямую» — только ноды (кроме того, что умеет один прокси:
 *   регистрация, переводы, превью ссылок — это по-прежнему через него);
 * - «Авто» (по умолчанию) — прокси, а если ни один не ответил при запуске
 *   или все перестали отвечать по ходу, а ноды отвечают — ноды. Пока идём
 *   напрямую, прокси перепроверяются раз в минуту, при смене сети и при
 *   возврате в приложение; ответил — возвращаемся на него.
 *
 * Ноды — запасной путь: через прокси быстрее (у него кэш и много нод за
 * спиной). Поэтому сбой не в счёт, когда приложение свёрнуто или только что
 * вернулось (система могла отрезать ему сеть, телефон её ещё поднимает), и
 * когда молчат и ноды — значит, сети нет вовсе.
 *
 * С включённым Tor режим не действует: запросы идут через Tor к прокси, а
 * мимо Tor приложение ничего не отправляет. В браузере прямого подключения
 * нет вовсе — только в приложениях.
 */

import servers from '@/servers.json'
import { torRoutingMode } from '@/helpers/tor/tor-gate'
import {
  isAppInBackground,
  isMobileAppInBackground,
  msSinceForeground,
  onAppForeground,
} from '@/helpers/common/app-foreground'
import { anyProxyAlive } from '../node-selector'
import { isOfflineNow } from '../offline'
import type { ServerEndpoint } from '../rpc-retry'
import { connectionState, type ConnectionMode, type ConnectionRoute } from './connection-state'
import { isNodeLinkAvailable } from './native-link'
import { directNodes } from './node-pool'

export type { ConnectionMode, ConnectionRoute } from './connection-state'

const MODE_KEY = 'bastyon_connection_mode'
const RECHECK_MS = 60_000
/** После возврата из фона сбои ещё не в счёт: сеть поднимается. */
const WAKE_GRACE_MS = 15_000
const PROXIES = servers.servers.production.proxy as ServerEndpoint[]

function readMode(): ConnectionMode {
  try {
    const value = globalThis.localStorage?.getItem(MODE_KEY)
    return value === 'proxy' || value === 'direct' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

connectionState.mode = readMode()

/** Решение «Авто»; null — ещё не принималось. */
let autoRoute: ConnectionRoute | null = null
let deciding: Promise<ConnectionRoute> | null = null
let recheckTimer: ReturnType<typeof setInterval> | null = null
let rechecking = false
const listeners = new Set<(route: ConnectionRoute) => void>()

/** Подписка на смену маршрута (сокет уведомлений переподключается). */
export function onRouteChange(listener: (route: ConnectionRoute) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setRoute(route: ConnectionRoute): ConnectionRoute {
  const previous = connectionState.route
  connectionState.route = route
  if (previous !== null && previous !== route) {
    for (const listener of listeners) {
      try {
        listener(route)
      } catch {
        // подписчик не должен ломать выбор
      }
    }
  }
  return route
}

/** Есть ли прямое подключение в этом окружении (приложение, а не браузер). */
export function directAvailable(): boolean {
  return isNodeLinkAvailable()
}

export async function connectionRoute(): Promise<ConnectionRoute> {
  if (!isNodeLinkAvailable()) return setRoute('proxy')
  if ((await torRoutingMode()) !== 'direct') return setRoute('proxy')
  const mode = connectionState.mode
  if (mode !== 'auto') return setRoute(mode)
  if (autoRoute) return setRoute(autoRoute)
  deciding ??= decide().finally(() => {
    deciding = null
  })
  return deciding
}

/** Отвечает ли напрямую хоть одна нода (выбор рабочих нод кэшируется). */
async function nodesAnswer(): Promise<boolean> {
  return directNodes().then(
    (hosts) => hosts.length > 0,
    () => false
  )
}

async function decide(): Promise<ConnectionRoute> {
  // Устройство без сети: ни прокси, ни 47 нод не пингуем и ничего не решаем —
  // решит первый запрос после возврата сети (autoRoute остаётся пустым).
  if (isOfflineNow()) return setRoute('proxy')
  // Молчат и прокси, и ноды — сети нет: остаёмся на прокси, а когда сеть
  // появится, сбой запроса решит заново (reportProxiesUnreachable).
  const direct = !(await anyProxyAlive(PROXIES)) && (await nodesAnswer())
  // Пока проверяли, режим могли сменить.
  if (connectionState.mode !== 'auto') return setRoute(connectionState.mode)
  autoRoute = direct ? 'direct' : 'proxy'
  if (autoRoute === 'direct') startRecheck()
  return setRoute(autoRoute)
}

/** Может ли запрос уйти к нодам, если прокси не отвечают: «Авто», без Tor, в приложении. */
export async function mayFallBackToDirect(): Promise<boolean> {
  return (
    connectionState.mode === 'auto' &&
    isNodeLinkAvailable() &&
    (await torRoutingMode()) === 'direct'
  )
}

/** Сбой сейчас ничего не говорит о прокси: приложение в фоне или сети нет. */
function failureDoesNotCount(): boolean {
  return (
    isAppInBackground() ||
    msSinceForeground() < WAKE_GRACE_MS ||
    globalThis.navigator?.onLine === false
  )
}

/**
 * Запрос не прошёл ни через один прокси (сбой сети, а не ответ ноды). В
 * режиме «Авто» дальше идём напрямую, если ноды отвечают; false — нельзя.
 */
export async function reportProxiesUnreachable(): Promise<boolean> {
  if (!(await mayFallBackToDirect())) return false
  if (autoRoute === 'direct') return true
  if (failureDoesNotCount() || !(await nodesAnswer())) return false
  // Пока спрашивали ноды, режим могли сменить, а другой запрос — уже уйти к ним.
  if (connectionState.mode !== 'auto' || failureDoesNotCount()) return false
  if (connectionState.route === 'direct') return true
  autoRoute = 'direct'
  setRoute('direct')
  startRecheck()
  return true
}

export function setConnectionMode(mode: ConnectionMode): void {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode)
  } catch {
    // не запомнится до перезапуска
  }
  connectionState.mode = mode
  autoRoute = null
  stopRecheck()
  void connectionRoute()
}

const onOnline = () => void recheck()
let stopForeground: (() => void) | null = null

function startRecheck(): void {
  if (recheckTimer) return
  // Свёрнутое мобильное приложение прокси не пингует: сбой в фоне и так не в
  // счёт, а при возвращении перепроверим сразу (ниже).
  recheckTimer = setInterval(() => {
    if (!isMobileAppInBackground()) void recheck()
  }, RECHECK_MS)
  globalThis.addEventListener?.('online', onOnline)
  // Вернулись в приложение — сразу, не ждём таймера (на Android видимость
  // страницы меняется на секунды позже).
  stopForeground = onAppForeground(onOnline)
  connectionOf()?.addEventListener?.('change', onOnline)
}

function stopRecheck(): void {
  if (recheckTimer) clearInterval(recheckTimer)
  recheckTimer = null
  globalThis.removeEventListener?.('online', onOnline)
  stopForeground?.()
  stopForeground = null
  connectionOf()?.removeEventListener?.('change', onOnline)
}

/** Смена Wi-Fi на мобильную сеть и обратно (там, где браузер о ней сообщает). */
function connectionOf(): EventTarget | null {
  const nav = globalThis.navigator as (Navigator & { connection?: EventTarget }) | undefined
  return nav?.connection ?? null
}

/** Прокси снова отвечают — возвращаемся на них. */
export async function recheck(): Promise<void> {
  if (connectionState.mode !== 'auto' || autoRoute !== 'direct') {
    stopRecheck()
    return
  }
  if (rechecking) return
  rechecking = true
  try {
    if (!(await anyProxyAlive(PROXIES))) return
    if (connectionState.mode !== 'auto' || autoRoute !== 'direct') return
    autoRoute = 'proxy'
    stopRecheck()
    setRoute('proxy')
  } finally {
    rechecking = false
  }
}

/** Сброс для тестов. */
export function resetConnectionRouteForTests(): void {
  stopRecheck()
  autoRoute = null
  deciding = null
  rechecking = false
  listeners.clear()
  connectionState.route = null
  connectionState.mode = readMode()
}
