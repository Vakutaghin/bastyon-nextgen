/**
 * Локальный детектор формата строки поиска эксплорера.
 *
 *  - целое неотрицательное число → block-height
 *  - 64 hex-символа → block-hash или txid (без сетевого запроса различить нельзя,
 *    но эти два пространства не пересекаются на практике; при попадании на блок
 *    /explorer/block/:x с переданным txid нода вернёт «не найдено» — на этот случай
 *    UI предлагает «попробовать как транзакцию»). Возвращаем 'hash64' и оставляем
 *    выбор маршрута за UI/serverу.
 *  - Pocketnet bech32-адрес (начинается с P, длина ~34, base58) → address.
 *  - всё остальное → 'unknown' (можно дёрнуть searchbyhash для подтверждения).
 *
 * Никаких сетевых запросов — детектор синхронный, безопасно вызывать на каждое
 * нажатие клавиши. Это важно для self-custody: опечатки пользователя не утекают
 * в логи ноды до того, как он сознательно нажал Enter / Search.
 */

export type SearchKind = 'block-height' | 'hash64' | 'address' | 'unknown'

const HEX64_RE = /^[0-9a-fA-F]{64}$/
const HEIGHT_RE = /^\d{1,9}$/
// Pocketnet P2PKH-адреса: префикс P, base58, обычно 34 символа (33–35 на практике).
const PKOIN_ADDRESS_RE = /^P[1-9A-HJ-NP-Za-km-z]{32,34}$/

export interface SearchClassification {
  kind: SearchKind
  /** Нормализованное значение (trim + lowercase для hex). */
  value: string
}

export function classifyExplorerQuery(raw: string): SearchClassification {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: 'unknown', value: '' }

  if (HEIGHT_RE.test(trimmed)) {
    return { kind: 'block-height', value: trimmed }
  }
  if (HEX64_RE.test(trimmed)) {
    return { kind: 'hash64', value: trimmed.toLowerCase() }
  }
  if (PKOIN_ADDRESS_RE.test(trimmed)) {
    return { kind: 'address', value: trimmed }
  }
  return { kind: 'unknown', value: trimmed }
}
