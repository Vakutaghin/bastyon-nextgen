<template>
  <!-- Пост — пузырём, как сообщение; по нажатию открывается целиком: оценки, комментарии, «Поделиться». -->
  <SC_Post
    role="button"
    tabindex="0"
    data-testid="channel-post"
    :data-txid="post.txid"
    :aria-label="t('messenger.channel.openPost')"
    @click="open(false)"
    @keydown.enter.prevent="open(false)"
    @keydown.space.prevent="open(false)"
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
      <!-- Картинки — сеткой, как в ленте; нажатие открывает их в просмотрщике. -->
      <SC_PostMedia v-if="post.images.length > 0">
        <PostCardImages :images="post.images" />
      </SC_PostMedia>
      <!-- Ролик: обложка, по нажатию — окно поста, и видео сразу играет. -->
      <SC_PostVideo
        v-else-if="isVideo"
        role="button"
        tabindex="0"
        data-testid="channel-video"
        :aria-label="t('messenger.channel.watchVideo')"
        @click.stop="open(true)"
        @keydown.enter.stop.prevent="open(true)"
        @keydown.space.stop.prevent="open(true)"
      >
        <img
          v-if="videoCover"
          :src="videoCover"
          alt=""
          loading="lazy"
          @error="coverFailed = true"
        />
        <SC_PlayBadge aria-hidden="true"><PlayIcon /></SC_PlayBadge>
        <SC_VideoSource v-if="embed">{{
          embed.kind === 'vimeo' ? 'Vimeo' : 'YouTube'
        }}</SC_VideoSource>
      </SC_PostVideo>
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
import { useTorMedia } from '@/composables/use-tor-media'
import { formatClock, formatDateTimeFromString } from '@/helpers/common/date-formatter'
import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import { usePostRestriction } from '@/b-components/content/post-card/use-post-restriction'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import type { AdaptedPost } from '@/types/adapted-post'
import { postBodyText, postKind, postTime, postVideoEmbed } from '../../lib/channels'
import {
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
  SC_PostVideo,
  SC_ReadMore,
  SC_VideoSource,
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

/** Ссылка на ролик YouTube или Vimeo: его и так видно обложкой. */
const VIDEO_LINK = /https?:\/\/\S*(?:youtube\.com|youtu\.be|vimeo\.com)\S*/gi

const body = computed<string>(() => {
  const plain = postBodyText(props.post)
  return embed.value ? plain.replace(VIDEO_LINK, '').trim() : plain
})
const truncated = computed<boolean>(() => body.value.length > TEXT_LIMIT)
const text = computed<string>(() =>
  truncated.value ? `${body.value.slice(0, TEXT_LIMIT).trimEnd()}…` : body.value
)

// --- Видео: свой ролик Bastyon (PeerTube) или YouTube и Vimeo по ссылке ---

const embed = computed(() => postVideoEmbed(props.post))
const isVideo = computed<boolean>(
  () =>
    ((props.post.type === 'video' || props.post.type === 'audio') && !!props.post.videoUrl) ||
    !!embed.value
)

// Под Tor обложки не грузим: картинка с чужого сервера ушла бы мимо Tor.
const { mediaBlocked } = useTorMedia()
const peertubeCover = ref<string | null>(null)
watch(
  () => (embed.value || mediaBlocked.value ? undefined : props.post.videoUrl),
  async (url) => {
    peertubeCover.value = null
    if (!url?.startsWith('peertube://')) return
    try {
      peertubeCover.value = await getVideoThumbnailFromUrl(url)
    } catch {
      /* без обложки — тёмная рамка со значком */
    }
  },
  { immediate: true }
)

const coverFailed = ref(false)
const videoCover = computed<string | undefined>(() => {
  if (coverFailed.value || mediaBlocked.value) return undefined
  if (embed.value?.kind === 'youtube')
    return `https://i.ytimg.com/vi/${embed.value.id}/hqdefault.jpg`
  return peertubeCover.value || undefined
})

const clock = computed<string>(() => formatClock(postTime(props.post)))
const fullDate = computed<string>(() => formatDateTimeFromString(props.post.timestamp))

function open(autoplay: boolean): void {
  // Окно поста принимает и адаптированный пост ленты (как post-embed), тип у него сырой.
  modalStore.openPostModal(
    props.post as unknown as Parameters<typeof modalStore.openPostModal>[0],
    { autoplay }
  )
}
</script>
