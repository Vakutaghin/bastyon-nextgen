// Константы композера поста.

/** Минимальная комиссия транзакции (как у комментария — 1 сатоши). */
export const POST_TX_FEE = 0.00000001

/** Максимум картинок на пост (kit.js: imagesHelper, лимит 10). */
export const MAX_IMAGES = 10

/** Максимум тегов на пост (kit.js Share). */
export const MAX_TAGS = 5

/** Максимум вариантов ответа в опросе (kit.js poll). */
export const MAX_POLL_OPTIONS = 5

/** Максимальный размер одной картинки до загрузки — 30 МБ. */
export const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024

/** Лимит размера payload обычного поста (kit.js:1831). */
export const POST_SIZE_LIMIT = 60_000

/** Лимит размера payload статьи (kit.js:1828). */
export const ARTICLE_SIZE_LIMIT = 120_000

/** Минимум осмысленного текста при наличии ссылки (анти-спам, kit.js:1563). */
export const URL_MIN_TEXT_LENGTH = 30
