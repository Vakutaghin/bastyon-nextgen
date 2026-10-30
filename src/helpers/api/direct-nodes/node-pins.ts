/**
 * Сертификаты нод, запомненные при первой встрече (TOFU). Подлинность
 * самоподписанного сертификата проверить не у кого, но подмену видно: тот же
 * адрес с другим сертификатом — уже не та нода, её пропускаем.
 *
 * Ключ — `IP:порт`: у API (38881) и WSS (8887) одной ноды сертификаты разные.
 *
 * Свой сертификат нода выпускает на год. Запись живёт дольше, а потом
 * забывается: после этого сменённый сертификат примется как новый.
 */

const STORAGE_KEY = 'bastyon_node_pins'
const PIN_TTL_MS = 400 * 24 * 3600 * 1000
const MAX_PINS = 500

interface PinRecord {
  fp: string
  at: number
}

type PinMap = Record<string, PinRecord>

function read(): PinMap {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as PinMap) : {}
  } catch {
    return {}
  }
}

function write(pins: PinMap): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // нет места или хранилище недоступно — проверка просто начнётся заново
  }
}

/** Запомненный отпечаток или null — первая встреча (или запись устарела). */
export function pinOf(endpoint: string, now = Date.now()): string | null {
  const record = read()[endpoint]
  if (!record || typeof record.fp !== 'string') return null
  return now - record.at < PIN_TTL_MS ? record.fp : null
}

/** Запомнить отпечаток при первой встрече; уже запомненный не меняется. */
export function rememberPin(endpoint: string, fingerprint: string, now = Date.now()): void {
  if (!fingerprint || pinOf(endpoint, now)) return
  const pins = read()
  pins[endpoint] = { fp: fingerprint.toLowerCase(), at: now }
  const keys = Object.keys(pins)
  if (keys.length > MAX_PINS) {
    keys
      .sort((a, b) => pins[a]!.at - pins[b]!.at)
      .slice(0, keys.length - MAX_PINS)
      .forEach((k) => delete pins[k])
  }
  write(pins)
}

/** Сброс для тестов. */
export function resetPinsForTests(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // нечего сбрасывать
  }
}
