const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Скрипт выхода обычного адреса (P2PKH) — для подменных монет кошелька. */
export function p2pkhScript(address: string): string {
  let n = 0n
  for (const c of address) n = n * 58n + BigInt(BASE58.indexOf(c))
  const hex = n.toString(16).padStart(50, '0')
  return `76a914${hex.slice(2, 42)}88ac`
}
