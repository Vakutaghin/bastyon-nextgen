// Трансформация URL изображений между доменами Bastyon

/** Базовый URL сервиса изображений */
const IMAGE_SERVICE_URL = 'https://pocketnet.app:8092'

/** Префикс для доступа к изображениям по хэшу */
const IMAGE_PATH_PREFIX = '/i/'

/**
 * Заменяет устаревший домен сервиса изображений на актуальный
 * (`bastyon.com:8092` → `pocketnet.app:8092`).
 *
 * @param url - URL изображения (может содержать старый домен)
 * @returns URL с актуальным доменом или исходное значение
 */
export function migrateLegacyImageHost(url: string): string {
  if (!url) return url

  return url.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
}

/**
 * Строит полный URL изображения из хэша или нормализует существующий URL.
 * Обрабатывает три варианта входных данных:
 * - полный URL с актуальным доменом → возвращает как есть
 * - полный URL с устаревшим доменом → заменяет домен
 * - хэш изображения → строит полный URL
 *
 * @param imageHashOrUrl - хэш изображения или полный URL
 * @returns полный нормализованный URL или undefined
 */
export function resolveImageUrl(imageHashOrUrl: string | undefined | null): string | undefined {
  if (!imageHashOrUrl) return undefined

  if (imageHashOrUrl.startsWith('http://') || imageHashOrUrl.startsWith('https://')) {
    return migrateLegacyImageHost(imageHashOrUrl)
  }

  return `${IMAGE_SERVICE_URL}${IMAGE_PATH_PREFIX}${imageHashOrUrl}`
}
