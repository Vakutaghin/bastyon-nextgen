/**
 * Чем идут запросы к блокчейну: через прокси или напрямую к нодам.
 *
 * Настройка «Подключение к сети»:
 * - «Прокси» — как всегда;
 * - «Ноды напрямую» — только ноды (кроме того, что умеет один прокси:
 *   регистрация, переводы, превью ссылок — это по-прежнему через него);
 * - «Авто» (по умолчанию) — прокси, а если ни один не ответил при запуске
 *   или все перестали отвечать по ходу — ноды. Пока идём напрямую, прокси
 *   перепроверяются раз в три минуты, при смене сети и при возврате в
 *   приложение; ответил — возвращаемся на него.
 *
 * С включённым Tor режим не действует: запросы идут через Tor к прокси, а
 * мимо Tor приложение ничего не отправляет. В браузере прямого подключения
 * нет вовсе — только в приложениях.
 */

import servers from '@/servers.json'
import { torRoutingMode } from '@/helpers/tor/tor-gate'
import { anyProxyAlive } from '../node-selector'
import type { ServerEndpoint } from '../rpc-retry'
import { connectionState, type ConnectionMode, type ConnectionRoute } from './connection-state'
import { isNodeLinkAvailable } from './native-link'

export type { ConnectionMode, ConnectionRoute } from './connection-state'

const MODE_KEY = 'bastyon_connection_mode'
const RECHECK_MS = 3 * 60_000
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

async function decide(): Promise<ConnectionRoute> {
  const alive = await anyProxyAlive(PROXIES)
  // Пока проверяли, режим могли сменить.
  if (connectionState.mode !== 'auto') return setRoute(connectionState.mode)
  autoRoute = alive ? 'proxy' : 'direct'
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

/**
 * Запрос не прошёл ни через один прокси (сбой сети, а не ответ ноды). В
 * режиме «Авто» дальше идём напрямую; false — нельзя.
 */
export async function reportProxiesUnreachable(): Promise<boolean> {
  if (!(await mayFallBackToDirect())) return false
  if (autoRoute === 'direct') return true
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

const onVisible = () => {
  if (document.visibilityState === 'visible') void recheck()
}
const onOnline = () => void recheck()

function startRecheck(): void {
  if (recheckTimer) return
  recheckTimer = setInterval(() => void recheck(), RECHECK_MS)
  globalThis.addEventListener?.('online', onOnline)
  globalThis.document?.addEventListener('visibilitychange', onVisible)
  connectionOf()?.addEventListener?.('change', onOnline)
}

function stopRecheck(): void {
  if (recheckTimer) clearInterval(recheckTimer)
  recheckTimer = null
  globalThis.removeEventListener?.('online', onOnline)
  globalThis.document?.removeEventListener('visibilitychange', onVisible)
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
