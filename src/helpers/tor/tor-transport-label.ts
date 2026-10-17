/**
 * Подписи для меню Tor: чем идёт подключение и в какой стране, по данным
 * Moat, находится пользователь (src-tauri/src/tor/connect.rs).
 */

/** Названия транспортов, как их пишет Tor Browser. */
const BRAND_NAMES: Record<string, string> = {
  snowflake: 'Snowflake',
  webtunnel: 'WebTunnel',
  obfs4: 'obfs4',
  meek: 'meek',
  meek_lite: 'meek',
  conjure: 'Conjure',
}

export type TorTransportLabel =
  | { kind: 'brand'; name: string }
  /** Свои мосты разных типов или мосты без транспорта — подпись из словаря. */
  | { kind: 'custom' }
  | { kind: 'vanilla' }

/** `null` — подключение без мостов (или ещё не начато). */
export function torTransportLabel(transport: string | null | undefined): TorTransportLabel | null {
  if (!transport || transport === 'direct') return null
  const brand = BRAND_NAMES[transport]
  if (brand) return { kind: 'brand', name: brand }
  if (transport === 'vanilla') return { kind: 'vanilla' }
  if (transport === 'custom') return { kind: 'custom' }
  return { kind: 'brand', name: transport }
}

/** `ru` → «Россия» на языке интерфейса; без Intl — код заглавными. */
export function countryDisplayName(code: string, locale: string): string {
  const upper = code.toUpperCase()
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(upper) ?? upper
  } catch {
    return upper
  }
}
