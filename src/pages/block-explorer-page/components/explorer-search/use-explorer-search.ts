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

export type ExplorerEntityKind = 'block' | 'tx' | 'address'

export interface ExplorerRouteSuggestion {
  kind: ExplorerEntityKind
  routeName: 'explorer-block' | 'explorer-tx' | 'explorer-address'
  paramKey: 'hashOrHeight' | 'txid' | 'address'
  value: string
}

/**
 * Список маршрутов эксплорера для строки запроса — для подсказок в любом поиске
 * (в т.ч. глобальном header-search). Чисто синхронно, без сети.
 *
 * 64-hex неоднозначен между блоком и транзакцией (локально не различить), поэтому
 * для него возвращаем ДВА варианта — блок и транзакцию. Для height/address — один.
 * `unknown` → пусто.
 */
export function explorerRouteSuggestions(raw: string): ExplorerRouteSuggestion[] {
  const { kind, value } = classifyExplorerQuery(raw)
  switch (kind) {
    case 'block-height':
      return [{ kind: 'block', routeName: 'explorer-block', paramKey: 'hashOrHeight', value }]
    case 'address':
      return [{ kind: 'address', routeName: 'explorer-address', paramKey: 'address', value }]
    case 'hash64':
      return [
        { kind: 'block', routeName: 'explorer-block', paramKey: 'hashOrHeight', value },
        { kind: 'tx', routeName: 'explorer-tx', paramKey: 'txid', value },
      ]
    default:
      return []
  }
}
