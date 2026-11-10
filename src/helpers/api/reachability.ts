/**
 * Сеть есть, а интернета нет.
 *
 * `navigator.onLine === true` значит только, что устройство куда-то
 * подключено: гостевой Wi-Fi до входа через его страницу, блокировка, роутер
 * без связи. Раньше каждый запрос тогда перебирал все 7 прокси и у каждого
 * ждал таймаута 30 с — до 3,5 мин на запрос, с повторами vue-query до 10. А
 * когда интернет появлялся, события `online` не было, и экран оставался с
 * ошибкой до «Повторить».
 *
 * Теперь (сам перебор — rpc-retry, запросы — request):
 *   - запрос ждёт ответа прокси дольше LIVENESS_AFTER_MS — прокси пингуются
 *     (один круг на всех, REACH_PROBE_TIMEOUT_MS); его прокси не ответил —
 *     запрос обрывается, не дожидаясь 30 с;
 *   - после сбоя следующий прокси пробуется, только если кто-то ответил на
 *     пинг; не ответил никто — связи нет (`noteUnreachable`);
 *   - пока связи нет, запрос к прокси сразу получает UnreachableError, если
 *     свежий круг пинга никого не нашёл, а связь перепроверяется сама: через
 *     5, 10, 20, 30 с, сразу — по `online`, при возврате в приложение и при
 *     смене сети. Ответил прокси — связь есть, подписчики `onNetworkBack`
 *     повторяют упавшее, как после `online`.
 *
 * Сторонние адреса проверки (generate_204 и т. п.) не спрашиваем: они бы
 * узнавали, что запущен Bastyon. Поэтому «нет интернета» и «Bastyon
 * заблокирован» неразличимы — в обоих случаях не отвечает ни один прокси.
 */

import servers from '@/servers.json'
import { isAppInBackground, onAppForeground } from '@/helpers/common/app-foreground'
import { pingProxy } from './node-selector'
import { isOfflineNow } from './offline'
import type { ServerEndpoint } from './rpc-retry'

/** Запрос ждёт ответа прокси дольше — проверяем, жив ли прокси. */
export const LIVENESS_AFTER_MS = 5_000
/**
 * Свой прокси молчит и на пинг дольше — пингуем заодно остальных: если связи
 * нет, это выяснится раньше, чем истечёт его пинг.
 */
export const SUSPECT_AFTER_MS = 3_000
/** Пинг прокси при проверке связи: с запасом на медленную сеть. */
export const REACH_PROBE_TIMEOUT_MS = 8_000
/** Пока связи нет, круг пинга не старше этого берём как есть. */
export const FRESH_ROUND_MS = 10_000
/** Пока связи нет — перепроверка через столько (дальше — последнее). */
export const REPROBE_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const
/** Поводы перепроверить разом (`online` и возврат в приложение) — один круг. */
const TRIGGER_DEDUP_MS = 1_000

const PROXIES = servers.servers.production.proxy as ServerEndpoint[]

export class UnreachableError extends Error {
  /** Признак без instanceof, как у OfflineError. */
  readonly unreachable = true

  constructor(what = 'request', cause?: unknown) {
    super(`No Bastyon server answers: ${what}`, cause === undefined ? undefined : { cause })
    this.name = 'UnreachableError'
  }
}

export function isUnreachableError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { unreachable?: unknown }).unreachable === true
}

export interface ProbeRound {
  /** Ответил ли хоть один прокси: true — с первым ответом, false — когда молчат все. */
  readonly any: Promise<boolean>
  /** Что об этом прокси уже известно; undefined — ещё ждём (или не из круга). */
  known(server: ServerEndpoint): boolean | undefined
}

const keyOf = (server: ServerEndpoint) => `${server.host}:${server.port}`

interface Ping {
  startedAt: number
  result: Promise<boolean>
  /** Ответ, когда пришёл. */
  value?: boolean
}

/** Последний пинг каждого прокси: его берут и проверка запроса, и круг. */
const pings = new Map<string, Ping>()
let unreachableSince: number | null = null
let reprobeTimer: ReturnType<typeof setTimeout> | null = null
let reprobeStep = 0
let detachTriggers: (() => void) | null = null
const backListeners = new Set<() => void>()

function ping(server: ServerEndpoint, notBefore: number): Ping {
  const key = keyOf(server)
  const last = pings.get(key)
  if (last && last.startedAt >= notBefore) return last
  const entry: Ping = {
    startedAt: Date.now(),
    result: Promise.resolve()
      .then(() => pingProxy(server, REACH_PROBE_TIMEOUT_MS))
      .then(
        (ok) => ok === true,
        () => false
      ),
  }
  // Раньше прочих обработчиков: к их вызову ответ уже записан.
  void entry.result.then((ok) => {
    entry.value = ok
    // Прокси ответил — связь есть.
    if (ok) noteReachable()
  })
  pings.set(key, entry)
  return entry
}

/**
 * Отвечает ли прокси на пинг, начатый не раньше `notBefore` (идущий или
 * недавний берётся как есть): запрос, который долго ждёт, проверяет свой прокси.
 */
export function proxyAnswers(server: ServerEndpoint, notBefore = Date.now()): Promise<boolean> {
  return ping(server, notBefore).result
}

/**
 * Круг пинга прокси не старше `notBefore`: идущие и недавние пинги берутся
 * как есть — на десятки разом упавших запросов один круг.
 */
export function probeRound(list: ServerEndpoint[] = PROXIES, notBefore = Date.now()): ProbeRound {
  const entries = new Map(list.map((server) => [keyOf(server), ping(server, notBefore)]))
  const any = new Promise<boolean>((resolve) => {
    let left = entries.size
    if (!left) resolve(false)
    for (const entry of entries.values()) {
      void entry.result.then((ok) => {
        left -= 1
        if (ok) resolve(true)
        else if (left === 0) resolve(false)
      })
    }
  })
  return {
    any,
    known: (server) => entries.get(keyOf(server))?.value,
  }
}

/**
 * Идти ли к прокси. Связь есть — да, сразу. Связи нет — по свежему кругу
 * пинга (идущий подождём, не старше FRESH_ROUND_MS возьмём как есть, иначе
 * начнём новый): кто-то ответил — да.
 */
export async function proxiesReachable(list: ServerEndpoint[] = PROXIES): Promise<boolean> {
  if (unreachableSince === null) return true
  return probeRound(list, Date.now() - FRESH_ROUND_MS).any
}

export function isUnreachable(): boolean {
  return unreachableSince !== null
}

/** Сколько секунд связи нет (для сведений в поддержку). */
export function unreachableForS(now = Date.now()): number | undefined {
  return unreachableSince === null ? undefined : Math.round((now - unreachableSince) / 1000)
}

/**
 * Ни один прокси не ответил, а устройство в сети: запросы к прокси дальше
 * сразу получают ошибку, а связь перепроверяется сама.
 */
export function noteUnreachable(): void {
  if (unreachableSince !== null || isOfflineNow()) return
  unreachableSince = Date.now()
  reprobeStep = 0
  attachTriggers()
  scheduleReprobe()
}

/** Прокси ответил. Если связи не было — подписчики повторяют упавшее. */
export function noteReachable(): void {
  if (unreachableSince === null) return
  unreachableSince = null
  if (reprobeTimer) clearTimeout(reprobeTimer)
  reprobeTimer = null
  detachTriggers?.()
  detachTriggers = null
  for (const listener of [...backListeners]) {
    try {
      listener()
    } catch (e) {
      console.warn('[reachability] network-back listener failed', e)
    }
  }
}

function scheduleReprobe(): void {
  if (reprobeTimer) clearTimeout(reprobeTimer)
  reprobeTimer = null
  if (unreachableSince === null) return
  const delay = REPROBE_DELAYS_MS[Math.min(reprobeStep, REPROBE_DELAYS_MS.length - 1)]
  reprobeStep += 1
  reprobeTimer = setTimeout(() => {
    reprobeTimer = null
    void reprobe(false)
  }, delay)
}

/**
 * Перепроверка связи. По таймеру — только при открытом приложении: свёрнутое
 * проверим при возвращении. Без сети — не сейчас, а по `online`.
 */
async function reprobe(triggered: boolean): Promise<void> {
  if (unreachableSince === null || isOfflineNow()) return
  if (!triggered && isAppInBackground()) return
  const ok = await probeRound(PROXIES, Date.now() - TRIGGER_DEDUP_MS).any
  if (!ok) scheduleReprobe()
}

function attachTriggers(): void {
  if (detachTriggers || typeof window === 'undefined') return
  const now = () => void reprobe(true)
  window.addEventListener('online', now)
  const stopForeground = onAppForeground(now)
  // Смена Wi-Fi на мобильную сеть (там, где браузер о ней сообщает).
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection
  connection?.addEventListener?.('change', now)
  detachTriggers = () => {
    window.removeEventListener('online', now)
    stopForeground()
    connection?.removeEventListener?.('change', now)
  }
}

/**
 * Связь вернулась: устройство снова в сети (`online`) или Bastyon снова
 * отвечает. Пока связи с Bastyon нет, `online` ещё ничего не значит —
 * подписчик узнает, когда ответит прокси (и повторит один раз, а не два).
 */
export function onNetworkBack(listener: () => void): () => void {
  backListeners.add(listener)
  const onOnline = () => {
    if (unreachableSince === null) listener()
  }
  globalThis.addEventListener?.('online', onOnline)
  return () => {
    backListeners.delete(listener)
    globalThis.removeEventListener?.('online', onOnline)
  }
}

/** Сброс для тестов. */
export function resetReachabilityForTests(): void {
  if (reprobeTimer) clearTimeout(reprobeTimer)
  reprobeTimer = null
  reprobeStep = 0
  detachTriggers?.()
  detachTriggers = null
  unreachableSince = null
  pings.clear()
  backListeners.clear()
}
