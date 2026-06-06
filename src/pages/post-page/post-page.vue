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
        />

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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { ICON_PRIMARY_40 } from '@/styles/icon-styles'
import Spin from '@/components/spin/spin.vue'
import PostCard from '@/b-components/content/post-card/post-card.vue'
import RelatedVideos from './related-videos/related-videos.vue'
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

const { post, isLoading, isMissing, isError } = usePostByTxid(txid)

const isVideoPost = computed<boolean>(
  () => post.value?.type === 'video' || post.value?.type === 'audio'
)
</script>
