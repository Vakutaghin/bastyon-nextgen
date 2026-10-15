/**
 * Закрыт ли пост от смотрящего и почему — для карточки поста и встроенного
 * в чат поста. Сеть видимость не проверяет (helpers/content/post-visibility),
 * а платную подписку — стор платных подписок: оплачено и подписан — открыт.
 */

import { useAuthStore } from '@/blockchain'
import { visibilityRestriction, type PostVisibility } from '@/helpers/content/post-visibility'
import { usePaidSubscriptionsStore } from '@/stores/paid-subscriptions-store'
import { useUserRelationsStore } from '@/stores/user-relations-store'

export interface PostRestriction {
  reason: Exclude<PostVisibility, 'all'>
  /** Чей пост закрыт: у репоста — автор оригинала. */
  author: string
}

/** Функция проверки: читает реактивные сторы, поэтому годится для computed. */
export function usePostRestriction(): (
  author: string | null | undefined,
  f: unknown
) => PostRestriction | null {
  const authStore = useAuthStore()
  const relations = useUserRelationsStore()
  const paid = usePaidSubscriptionsStore()
  return (author, f) => {
    const reason = visibilityRestriction(author, f, {
      address: authStore.getUserAddress,
      isSubscribedTo: (address: string) => relations.isSubscribed(address),
    })
    if (!reason) return null
    if (reason === 'paid' && author && paid.accessFor(author) === 'open') return null
    return { reason, author: author ?? '' }
  }
}
