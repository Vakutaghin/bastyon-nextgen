/**
 * Конфигурация сети Pocketnet
 * Pocketnet использует кастомную сеть с адресами, начинающимися с 'P'
 */

import type { Network } from '../types/btc17-types'

/**
 * Сеть Pocketnet
 * Адреса начинаются с 'P' (pubKeyHash = 0x37 = 55)
 * Это отличается от Bitcoin mainnet (pubKeyHash = 0x00, адреса начинаются с '1')
 *
 * ВАЖНО: Значение 0x37 было определено эмпирически путем проверки реальных адресов Pocketnet
 */
export const POCKETNET_NETWORK: Network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x37, // 55 — адреса аккаунтов начинаются с 'P'
  scriptHash: 0x50, // 80 — адреса кошельков (P2SH) начинаются с 'Z', как в старом приложении (lib/pocketnet/modules/networks.js)
  wif: 0x21, // 33 — WIF ключи (как в Pocketnet mainnet)
}

/**
 * Проверяет, используется ли сеть Pocketnet
 */
export function isPocketnetNetwork(network?: Network): boolean {
  if (!network) return false
  return network.pubKeyHash === POCKETNET_NETWORK.pubKeyHash
}
