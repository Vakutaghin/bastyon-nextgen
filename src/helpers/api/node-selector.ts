/**
 * Выбор живой прокси-ноды (health-aware sticky selection).
 *
 * Заменяет прежний слепой round-robin со стартом с фиксированного индекса
 * (исторически 4.pocketnet.app, который сейчас мёртв) + блокирующий Fibonacci-
 * backoff, который await-ился в начале КАЖДОГО запроса и копился на мёртвых
 * нодах. Из-за отсутствия таймаута у RPC-фетча запрос к мёртвой ноде висел до
 * сетевого таймаута ОС (~75с) — лента не грузилась.
 *
 * Поведение повторяет оригинал (pocketnet.gui js/lib/client/api.js):
 *   - на «холодном» старте параллельно пингуем ВСЕ прокси (POST /ping, короткий
 *     таймаут) и выбираем первую живую по порядку списка (get.working → wproxies[0]);
 *   - «липнем» к выбранной ноде: пока запросы к ней успешны, не перепингуем
 *     (доверие на TRUST_TTL_MS, как 120s ping-cache в оригинале);
 *   - при ошибке транспорта к текущей ноде сбрасываем её → следующий запрос
 *     перевыберет живую.
 *
 * Выбор кэшируется в localStorage, чтобы переживать перезагрузку страницы.
 */

import { appFetch } from './fetch-strategies'
import type { ServerEndpoint } from './rpc-retry'

const STORAGE_KEY = 'bastyon_live_proxy'

/** Таймаут health-пинга одной ноды. */
const PROBE_TIMEOUT_MS = 4_000

/** Сколько доверяем выбранной ноде без перепинга (как 120s ping-cache в оригинале). */
const TRUST_TTL_MS = 120_000

interface CurrentState {
  proxy: ServerEndpoint
  validatedAt: number
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function readStored(): ServerEndpoint | null {
  if (!hasLocalStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.host === 'string' && typeof parsed.port === 'number') {
      return { host: parsed.host, port: parsed.port }
    }
  } catch {
    /* corrupted entry — игнорируем */
  }
  return null
}

function writeStored(proxy: ServerEndpoint | null): void {
  if (!hasLocalStorage()) return
  try {
    if (proxy) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proxy))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* quota / disabled storage — не критично */
  }
}

// Восстановленную из localStorage ноду НЕ считаем валидированной (validatedAt=0):
// первый же запрос либо подтвердит её успехом, либо перевыберет.
let current: CurrentState | null = (() => {
  const stored = readStored()
  return stored ? { proxy: stored, validatedAt: 0 } : null
})()

/** Дедуп параллельных перевыборов: все ждут один и тот же probe-all. */
let selectionInFlight: Promise<ServerEndpoint[]> | null = null

function sameServer(a: ServerEndpoint, b: ServerEndpoint): boolean {
  return a.host === b.host && a.port === b.port
}

function setCurrent(proxy: ServerEndpoint): void {
  current = { proxy, validatedAt: Date.now() }
  writeStored(proxy)
}

/**
 * Health-пинг одной ноды: POST /ping с принудительным таймаутом через
 * AbortController. /ping у прокси лёгкий (≈0.4s) и отвечает 200 пока прокси жив.
 */
async function probe(server: ServerEndpoint): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await appFetch(`https://${server.host}:${server.port}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: '{}',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Пингует все прокси параллельно, выбирает первую живую (по порядку списка) как
 * текущую и возвращает список, упорядоченный «живые → мёртвые» (мёртвые в хвосте
 * как последняя надежда). Если живых нет — возвращает исходный порядок.
 */
async function probeAll(proxies: ServerEndpoint[]): Promise<ServerEndpoint[]> {
  const results = await Promise.all(
    proxies.map(async (p) => ({ proxy: p, ok: await probe(p) })),
  )
  const live = results.filter((r) => r.ok).map((r) => r.proxy)
  const dead = results.filter((r) => !r.ok).map((r) => r.proxy)

  if (live[0]) setCurrent(live[0])

  return live.length ? [...live, ...dead] : proxies
}

/**
 * Возвращает прокси, упорядоченные «живая нода первой».
 *
 * - Если есть свежевалидированная текущая нода (в пределах TTL) — ставим её
 *   первой без перепинга, остальные следом (failover).
 * - Иначе — пингуем все параллельно и выбираем живую (с дедупом параллельных
 *   вызовов через `selectionInFlight`).
 */
export async function orderedProxies(proxies: ServerEndpoint[]): Promise<ServerEndpoint[]> {
  if (!proxies.length) return proxies

  if (current && Date.now() - current.validatedAt < TRUST_TTL_MS) {
    const cur = current.proxy
    const rest = proxies.filter((p) => !sameServer(p, cur))
    // Текущую ноду берём из списка (на случай если её уже нет в конфиге — тогда перевыбор).
    const stillInList = proxies.find((p) => sameServer(p, cur))
    if (stillInList) return [stillInList, ...rest]
  }

  if (!selectionInFlight) {
    selectionInFlight = probeAll(proxies).finally(() => {
      selectionInFlight = null
    })
  }
  return selectionInFlight
}

/** Отметить ноду живой (успешный запрос) — продлевает доверие/стикинесс. */
export function markProxyAlive(server: ServerEndpoint): void {
  setCurrent(server)
}

/** Отметить ноду мёртвой (ошибка транспорта) — сбрасывает текущую, если это она. */
export function markProxyDead(server: ServerEndpoint): void {
  if (current && sameServer(current.proxy, server)) {
    current = null
    writeStored(null)
  }
}

/** Сброс состояния выбора (для тестов). */
export function resetProxySelection(): void {
  current = null
  selectionInFlight = null
  writeStored(null)
}
