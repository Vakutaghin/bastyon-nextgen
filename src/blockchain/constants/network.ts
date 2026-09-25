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
  // Версии расширенных ключей — как в сети старого клиента (вендоренный
  // lib/pocketnet/modules/networks.js). На адреса и WIF они не влияют:
  // используются только при сериализации xpub/xprv, которой здесь нет.
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x37, // 55 — адреса аккаунтов начинаются с 'P'
  scriptHash: 0x50, // 80 — адреса кошельков (P2SH) начинаются с 'Z', как в старом приложении (lib/pocketnet/modules/networks.js)
  wif: 0x21, // 33 — WIF ключи (как в Pocketnet mainnet)
}
