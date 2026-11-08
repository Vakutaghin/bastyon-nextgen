/**
 * Закреплённый пост профиля — отдельно от ленты, по txid из настроек аккаунта
 * (pinned-posts-store). Так он стоит первым, не дожидаясь своей страницы
 * ленты, и сразу меняется, когда автор закрепил другой.
 *
 * Не автора (настройку пишет сам автор, но txid в ней может быть любым) и
 * удалённый пост не показываем — как будто ничего не закреплено.
 */

import { ref, watch, type Ref } from 'vue'
import { extractPostsFromResponse, type AdaptedPost } from '@/composables/use-feed'
import { fetchRawPostsByIds } from '@/composables/helpers/feed-queries'
import {
  fetchAndMergeRepostOriginals,
  preloadLastCommentAuthors,
} from '@/composables/helpers/feed-enrichment'

export function usePinnedPost(
  address: () => string,
  pinTxid: () => string | undefined
): Ref<AdaptedPost | null> {
  const post = ref<AdaptedPost | null>(null)
  let seq = 0

  watch(
    () => [address(), pinTxid() ?? ''] as const,
    async ([author, txid]) => {
      const mine = ++seq
      if (!author || !txid) {
        post.value = null
        return
      }
      if (post.value?.txid === txid) return
      try {
        const raw = (await fetchRawPostsByIds([txid])).get(txid)
        if (mine !== seq) return
        if (!raw || raw.address !== author) {
          post.value = null
          return
        }
        const contents = [raw]
        const [adapted] = extractPostsFromResponse({ data: { contents } } as never)
        if (!adapted) {
          post.value = null
          return
        }
        await Promise.all([
          fetchAndMergeRepostOriginals([adapted], contents),
          preloadLastCommentAuthors(contents),
        ])
        if (mine === seq) post.value = adapted
      } catch (e) {
        console.warn('[profile] pinned post failed', txid, e)
        if (mine === seq) post.value = null
      }
    },
    { immediate: true }
  )

  return post
}
