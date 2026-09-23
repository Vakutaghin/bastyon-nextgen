/**
 * Фильтр контента заблокированных авторов (решение Р3 по S21).
 *
 * On-chain блокировка раньше применялась только к комментариям и профилю:
 * посты заблокированного продолжали приходить в ленту, в рекомендации и в
 * продвигаемые. Legacy фильтрует их на клиенте — делаем так же, одной функцией
 * на все списки.
 *
 * Свой профиль заблокированного автора при этом открывается как прежде:
 * блокировка убирает его из общих лент, а не запрещает смотреть страницу.
 */

import { computed } from 'vue'
import { useUserRelationsStore } from '@/stores/user-relations-store'

/** Минимум, который нужен фильтру от поста. */
export interface PostWithAuthor {
  author?: { address?: string }
  address?: string
  repostAuthor?: { address?: string }
}

/** Адрес автора поста (в адаптированном посте он лежит в `author.address`). */
function authorAddressOf(post: PostWithAuthor): string {
  return post.author?.address || post.address || ''
}

/**
 * Заблокирован ли автор поста (или автор оригинала, если это репост).
 * Чистая функция — чтобы можно было проверить без монтирования компонента.
 */
export function isPostFromBlockedAuthor(
  post: PostWithAuthor,
  blocked: ReadonlySet<string>
): boolean {
  if (blocked.size === 0) return false
  const author = authorAddressOf(post)
  if (author && blocked.has(author)) return true
  const repostAuthor = post.repostAuthor?.address
  return !!repostAuthor && blocked.has(repostAuthor)
}

/** Реактивный фильтр для списков постов. */
export function useBlockedAuthors() {
  const relations = useUserRelationsStore()
  const blocked = computed<ReadonlySet<string>>(() => relations.blockedSet)

  return {
    blocked,
    /** Пропускает только посты незаблокированных авторов. */
    filterBlocked<T extends PostWithAuthor>(posts: T[]): T[] {
      if (blocked.value.size === 0) return posts
      return posts.filter((p) => !isPostFromBlockedAuthor(p, blocked.value))
    },
  }
}
