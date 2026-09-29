/**
 * Видимость поста: кому автор открыл пост (поле `s.f` в блокчейне).
 *
 * Сеть видимость не проверяет: текст поста лежит в блокчейне открыто, и нода
 * отдаёт его всем. Прятать пост от тех, кому он не адресован, — работа
 * приложения, как в старом клиенте (`kit.js` share.visibility и
 * `satolist.js` shares.checkvisibility). Раньше это приложение запись
 * `f` только писало, а показывало такие посты всем.
 *
 * Отличие от старого клиента: платную подписку здесь проверить нечем, поэтому
 * пост «для платных подписчиков» видит только автор.
 */

/** Кому открыт пост. */
export type PostVisibility = 'all' | 'subscribers' | 'registered' | 'paid'

/** Кто смотрит на пост. */
export interface PostViewer {
  /** Адрес вошедшего пользователя, пусто у гостя. */
  address: string | null | undefined
  /** Подписан ли смотрящий на этот адрес. */
  isSubscribedTo: (address: string) => boolean
}

/** `s.f` поста → видимость. Неизвестное значение — «для всех», как в старом клиенте. */
export function postVisibilityOf(f: unknown): PostVisibility {
  switch (String(f ?? '0')) {
    case '1':
      return 'subscribers'
    case '2':
      return 'registered'
    case '3':
      return 'paid'
    default:
      return 'all'
  }
}

/**
 * Скрыт ли пост от смотрящего: возвращает видимость, из-за которой скрыт, или
 * `null`, если показывать можно.
 */
export function visibilityRestriction(
  authorAddress: string | null | undefined,
  f: unknown,
  viewer: PostViewer
): Exclude<PostVisibility, 'all'> | null {
  const visibility = postVisibilityOf(f)
  if (visibility === 'all') return null
  const me = viewer.address || ''
  if (me && authorAddress && me === authorAddress) return null
  switch (visibility) {
    case 'registered':
      return me ? null : 'registered'
    case 'subscribers':
      return me && authorAddress && viewer.isSubscribedTo(authorAddress) ? null : 'subscribers'
    case 'paid':
      return 'paid'
  }
}
