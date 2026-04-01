// Хелперы компонента перевода

import { POCKETNET_ADDRESS_REGEX } from './consts'

/**
 * Проверяет, похожа ли строка на Pocketnet-адрес.
 */
export function looksLikeAddress(input: string): boolean {
  return POCKETNET_ADDRESS_REGEX.test(input)
}
