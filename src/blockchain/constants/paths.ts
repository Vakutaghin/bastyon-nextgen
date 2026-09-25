/**
 * Константы для BIP32 путей деривации ключей
 */

/**
 * Базовый путь для основного адреса пользователя
 * Формат: m/44'/0'/0'/n'
 */
export const MAIN_ADDRESS_PATH = "m/44'/0'/0'"

/**
 * Генерирует BIP32 путь для основного адреса по индексу
 * @param index - Индекс адреса (по умолчанию 0)
 * @returns BIP32 путь, например: "m/44'/0'/0'/0'"
 */
export function getMainAddressPath(index: number = 0): string {
  return `${MAIN_ADDRESS_PATH}/${index}'`
}
