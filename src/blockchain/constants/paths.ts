/**
 * Константы для BIP32 путей деривации ключей
 */

/**
 * Базовый путь для основного адреса пользователя
 * Формат: m/44'/0'/0'/n'
 */
export const MAIN_ADDRESS_PATH = "m/44'/0'/0'"

/**
 * Базовый путь для криптографических ключей
 * Формат: m/33'/0'/0'/n'
 */
export const CRYPTO_KEY_PATH = "m/33'/0'/0'"

/**
 * Генерирует BIP32 путь для основного адреса по индексу
 * @param index - Индекс адреса (по умолчанию 0)
 * @returns BIP32 путь, например: "m/44'/0'/0'/0'"
 */
export function getMainAddressPath(index: number = 0): string {
  return `${MAIN_ADDRESS_PATH}/${index}'`
}

/**
 * Генерирует BIP32 путь для криптографического ключа по индексу
 * @param index - Индекс ключа (1-12)
 * @returns BIP32 путь, например: "m/33'/0'/0'/1'"
 */
export function getCryptoKeyPath(index: number): string {
  if (index < 1 || index > 12) {
    throw new Error('Crypto key index must be between 1 and 12')
  }
  return `${CRYPTO_KEY_PATH}/${index}'`
}
