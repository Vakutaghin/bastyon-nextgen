<template>
  <!-- Пост — пузырём, как сообщение; по нажатию открывается целиком: оценки, комментарии, «Поделиться». -->
  <SC_Post
    role="button"
    tabindex="0"
    data-testid="channel-post"
    :data-txid="post.txid"
    :aria-label="t('messenger.channel.openPost')"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <SC_PostRepost v-if="post.repost">
      <RetweetOutlined />
      {{ repostLabel }}
    </SC_PostRepost>

    <SC_PostLocked v-if="restriction">
      <LockOutlined />
      {{ t(`postCard.visibility.${restriction}`) }}
    </SC_PostLocked>

    <template v-else>
      <SC_PostMedia v-if="mediaSrc">
        <img :src="mediaSrc" alt="" loading="lazy" @error="mediaFailed = true" />
        <SC_PlayBadge v-if="kind === 'video'" aria-hidden="true"><PlayIcon /></SC_PlayBadge>
        <SC_MoreImages v-if="moreImages > 0">+{{ moreImages }}</SC_MoreImages>
      </SC_PostMedia>
      <SC_PostKind v-else-if="kind === 'video'">
        <PlayIcon />
        {{ t('messenger.channel.kinds.video') }}
      </SC_PostKind>
      <SC_PostKind v-if="kind === 'article'">{{
        t('messenger.channel.kinds.article')
      }}</SC_PostKind>

      <SC_PostTitle v-if="post.title">{{ post.title }}</SC_PostTitle>
      <SC_PostText v-if="text">{{ text }}</SC_PostText>
      <SC_ReadMore v-if="truncated">{{ t('messenger.channel.readMore') }}</SC_ReadMore>
    </template>

    <SC_PostFooter>
      <SC_PostStat
        v-if="post.scoreCnt > 0"
        :title="t('messenger.channel.rating', { n: post.scoreCnt }, post.scoreCnt)"
      >
        <StarFilled />
        {{ post.ratingStars.toFixed(1) }}
      </SC_PostStat>
      <SC_PostStat
        v-if="post.comments > 0"
        :title="t('messenger.channel.comments', { n: post.comments }, post.comments)"
      >
        <MessageOutlined />
        {{ post.comments }}
      </SC_PostStat>
      <SC_PostTime :title="fullDate">{{ clock }}</SC_PostTime>
    </SC_PostFooter>
  </SC_Post>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  LockOutlined,
  MessageOutlined,
  PlayIcon,
  RetweetOutlined,
  StarFilled,
} from '@/components/icons'
import { useModalStore } from '@/stores/modal-store'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatClock, formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import { usePostRestriction } from '@/b-components/content/post-card/use-post-restriction'
import type { AdaptedPost } from '@/types/adapted-post'
import { postBodyText, postKind, postTime } from '../../lib/channels'
import {
  SC_MoreImages,
  SC_PlayBadge,
  SC_Post,
  SC_PostFooter,
  SC_PostKind,
  SC_PostLocked,
  SC_PostMedia,
  SC_PostRepost,
  SC_PostStat,
  SC_PostText,
  SC_PostTime,
  SC_PostTitle,
  SC_ReadMore,
} from './styled'

/** Длиннее — «Читать полностью» в окне поста. */
const TEXT_LIMIT = 600

const props = defineProps<{ post: AdaptedPost }>()
const { t } = useI18n()
const modalStore = useModalStore()
const restrictionOf = usePostRestriction()

const kind = computed(() => postKind(props.post))

const restriction = computed(
  () => restrictionOf(props.post.author?.address, props.post.settings?.f)?.reason ?? null
)

const repostLabel = computed<string>(() => {
  const name = props.post.repostAuthor?.name
  return name ? t('messenger.channel.repostFrom', { name }) : t('messenger.channel.kinds.repost')
})

const body = computed<string>(() => postBodyText(props.post))
const truncated = computed<boolean>(() => body.value.length > TEXT_LIMIT)
const text = computed<string>(() =>
  truncated.value ? `${body.value.slice(0, TEXT_LIMIT).trimEnd()}…` : body.value
)

// Обложка: первая картинка, у видео PeerTube — кадр с его сервера.
const videoThumb = ref<string | null>(null)
watch(
  () => (kind.value === 'video' ? props.post.videoUrl : undefined),
  async (url) => {
    videoThumb.value = null
    if (!url?.startsWith('peertube://')) return
    try {
      videoThumb.value = await getVideoThumbnailFromUrl(url)
    } catch {
      /* без обложки — подпись «Видео» */
    }
  },
  { immediate: true }
)

const mediaFailed = ref(false)
const mediaSrc = computed<string | undefined>(() => {
  if (mediaFailed.value) return undefined
  const first = props.post.images[0]
  if (first) return resolveImageUrl(first) || undefined
  return videoThumb.value || undefined
})
const moreImages = computed<number>(() => Math.max(0, props.post.images.length - 1))

const clock = computed<string>(() => formatClock(postTime(props.post)))
const fullDate = computed<string>(() => formatDateTimeFromString(props.post.timestamp))

function open(): void {
  // Окно поста принимает и адаптированный пост ленты (как post-embed), тип у него сырой.
  modalStore.openPostModal(props.post as unknown as Parameters<typeof modalStore.openPostModal>[0])
}
</script>
