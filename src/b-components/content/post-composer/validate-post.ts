/**
 * Валидация поста перед публикацией.
 *
 * Портировано из старого приложения `pocketnet.gui/js/kit.js`:
 *   - validation() — kit.js:1543
 *   - size()       — kit.js:1815
 *   - sizelimit()  — kit.js:1826
 *
 * Чистые функции (без Vue/стора) — удобно тестировать и переиспользовать в композере.
 */

import {
  exportPost,
  resolvePostOperationType,
  type SharePostData,
} from '@/blockchain/core/actions/post-action'

import {
  ARTICLE_SIZE_LIMIT,
  MAX_IMAGES,
  MAX_TAGS,
  POST_SIZE_LIMIT,
  URL_MIN_TEXT_LENGTH,
} from './consts'

/** Тег биржевой торговли — несовместим с рядом полей (kit.js:1700 hasexchangetag). */
const EXCHANGE_TAG = 'pkoin_commerce'

/** Коды ошибок валидации (соответствуют ключам i18n postMsg.validation.*). */
export type PostValidationError =
  | 'empty' // нет message / caption / repost
  | 'language' // не указан язык
  | 'videoCaption' // видео/аудио без заголовка
  | 'urlSpam' // ссылка без достаточного текста и без картинок
  | 'scheduledInvalid' // некорректное время отложенной публикации (settings.t === 1)
  | 'tags' // нет тегов (и это не репост)
  | 'tooManyTags' // больше MAX_TAGS тегов
  | 'tooManyImages' // больше MAX_IMAGES картинок
  | 'exchangeTag' // конфликт тега pkoin_commerce
  | 'pollTitle' // опрос без вопроса
  | 'pollOptions' // в опросе меньше 2 вариантов
  | 'tooLarge' // превышен лимит размера payload

/** Лимит размера payload в зависимости от типа (kit.js:1826). */
export function postSizeLimit(post: SharePostData): number {
  return resolvePostOperationType(post) === 'article' ? ARTICLE_SIZE_LIMIT : POST_SIZE_LIMIT
}

/**
 * Размер payload в символах (kit.js:1815).
 * base64-данные картинок заменяются плейсхолдером, т.к. к моменту проверки
 * картинки уже должны быть загружены и заменены на URL.
 */
export function postSize(post: SharePostData): number {
  const json = JSON.stringify(exportPost(post))
    .replace(/base64,[^ ",]*/g, 'fileinb64')
    .replace(/base64%2C[^ ",]*/g, 'fileinb64')
  return json.length
}

/**
 * Проверяет пост. Возвращает первый код ошибки или null, если всё валидно.
 * Порядок проверок повторяет kit.js:1543.
 */
export function validatePost(post: SharePostData): PostValidationError | null {
  const message = post.message || ''
  const caption = post.caption || ''
  const url = post.url || ''
  const tags = post.tags || []
  const images = post.images || []
  const repost = post.txidRepost || ''

  const opType = resolvePostOperationType(post)
  const hasArticleBlocks = opType === 'article' && (post.articleContent?.blocks?.length ?? 0) > 0
  // Опрос активен, если в payload есть поле list (см. cleanedPoll в use-post-composer).
  const poll =
    post.poll && 'list' in post.poll ? (post.poll as { title: string; list: string[] }) : null
  const hasPoll = !!poll && (!!poll.title || poll.list.length > 0)

  // 1. Пустой пост (для статьи учитываем блоки Editor.js, для опроса — наличие опроса).
  if (!message && !caption && !repost && !hasArticleBlocks && !hasPoll) return 'empty'

  // 2. Язык обязателен.
  if (!post.language) return 'language'

  // 3. Видео/аудио без заголовка.
  if ((opType === 'video' || opType === 'audio') && !caption) return 'videoCaption'

  // 3.5. Опрос: нужен вопрос и минимум 2 варианта.
  if (poll) {
    if (!poll.title) return 'pollTitle'
    if (poll.list.length < 2) return 'pollOptions'
  }

  // 4. Ссылка-спам: есть url (не видео/аудио), мало текста и нет картинок.
  if (url && opType !== 'video' && opType !== 'audio') {
    const textLength = (message.trim() + caption.trim()).replace(url, '').trim().length
    if (textLength < URL_MIN_TEXT_LENGTH && images.length === 0) return 'urlSpam'
  }

  // 5. Некорректное время отложенной публикации.
  if (post.settings?.t === 1) return 'scheduledInvalid'

  // 6. Теги обязательны (кроме репоста).
  if (tags.length === 0 && !repost) return 'tags'
  if (tags.length > MAX_TAGS) return 'tooManyTags'

  // 7. Лимит картинок.
  if (images.length > MAX_IMAGES) return 'tooManyImages'

  // 8. Конфликт биржевого тега.
  if (
    tags.includes(EXCHANGE_TAG) &&
    (tags.length > 1 || repost || opType === 'video' || opType === 'audio' || Boolean(url))
  ) {
    return 'exchangeTag'
  }

  // 9. Лимит размера payload.
  if (postSize(post) > postSizeLimit(post)) return 'tooLarge'

  return null
}
