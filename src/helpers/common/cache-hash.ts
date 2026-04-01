// Генерация уникального хэша для инвалидации кэша RPC-запросов

/**
 * Создаёт уникальный cachehash для обхода серверного кэша.
 * Используется при запросах, где нужны свежие данные (лента, рейтинги).
 *
 * Формат: base36(timestamp) + base36(random) — компактный и уникальный.
 *
 * @returns уникальная строка для параметра cachehash
 */
export function generateCacheHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}
