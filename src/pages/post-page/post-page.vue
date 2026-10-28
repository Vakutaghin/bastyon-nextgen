<template>
  <SC_PostPage class="adj">
    <SC_PostPageInner>
      <SC_PostStatus v-if="isLoading">
        <Spin :tip="t('postPage.loading')">
          <template #indicator>
            <LoadingOutlined :style="ICON_PRIMARY_40" spin />
          </template>
        </Spin>
      </SC_PostStatus>

      <template v-else-if="post">
        <PostCard
          :post="post"
          :show-full="true"
          :target-comment-id="targetCommentId"
          :target-parent-id="targetParentId"
          :target-reply="targetReply"
          :autoplay-video="autoplayFromQueue"
          @media-ended="upNext?.onEnded()"
        />

        <UpNext v-if="inQueue" ref="upNext" />

        <RelatedVideos
          v-if="isVideoPost && post.author?.address"
          :author-address="post.author.address"
          :exclude-txid="String(post.txid || post.hash || post.id || '')"
        />
      </template>

      <SC_PostStatus v-else-if="isMissing">{{ t('postPage.notFound') }}</SC_PostStatus>
      <SC_PostStatus v-else-if="isError">{{ t('postPage.error') }}</SC_PostStatus>
    </SC_PostPageInner>
  </SC_PostPage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined } from '@/components/icons'
import { ICON_PRIMARY_40 } from '@/styles/icon-styles'
import Spin from '@/components/spin/spin.vue'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import RelatedVideos from './related-videos/related-videos.vue'
import UpNext from './up-next/up-next.vue'
import { usePlaybackQueueStore } from '@/stores/playback-queue-store'
import { QUEUE_QUERY } from '@/composables/use-playback'
import { usePostByTxid } from '@/b-components/messenger/components/post-embed/use-post-by-txid'
import { SC_PostPage, SC_PostPageInner, SC_PostStatus } from './post-page.styled'

const route = useRoute()
const { t } = useI18n()

const txid = computed<string>(() =>
  typeof route.params.txid === 'string' ? route.params.txid : ''
)

/** Deep-link на конкретный комментарий: `?commentid=...&parentid=...` (legacy-формат). */
function queryStr(key: string): string | undefined {
  const v = route.query[key]
  return typeof v === 'string' && v ? v : undefined
}
const targetCommentId = computed<string | undefined>(
  () => queryStr('commentid') ?? queryStr('commentId')
)
const targetParentId = computed<string | undefined>(
  () => queryStr('parentid') ?? queryStr('parentId')
)
/**
 * Открыть форму ответа — страницу открыли кнопкой «Ответить» в уведомлении.
 * Флаг в состоянии истории, а не в адресе: ссылкой на комментарий делятся, и
 * у получателя форма ответа сама открываться не должна.
 */
const targetReply = computed<boolean>(() => {
  void route.fullPath
  const state: unknown = typeof window !== 'undefined' ? window.history.state : null
  return !!(state && typeof state === 'object' && (state as { reply?: unknown }).reply === true)
})

const { post, isLoading, isMissing, isError } = usePostByTxid(txid)

// Ролик из очереди проигрывания (плейлист, «Сохранённые»): «Далее» и автопереход.
const queue = usePlaybackQueueStore()
const upNext = ref<InstanceType<typeof UpNext> | null>(null)
const inQueue = computed<boolean>(
  () => queue.current?.type === 'video' && queue.current.id === txid.value
)
/** Открыли из очереди — ролик запускается сам. */
const autoplayFromQueue = computed<boolean>(() => inQueue.value && route.query[QUEUE_QUERY] === '1')

const isVideoPost = computed<boolean>(
  () => post.value?.type === 'video' || post.value?.type === 'audio'
)
</script>
