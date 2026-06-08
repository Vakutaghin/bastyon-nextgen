<template>
  <SC_PostCard v-if="deleted" hoverable role="article">
    <SC_RepostDeleted>
      <DeleteOutlined class="repost-deleted-icon" />
      <span>{{ t('postCard.deleted') }}</span>
    </SC_RepostDeleted>
  </SC_PostCard>
  <SC_PostCard v-else ref="postCardRef" hoverable role="article">
    <PostCardHeader :post="post" :author-override="authorOverride" />

    <component :is="isRepost ? SC_RepostInnerCard : 'div'">
      <SC_RepostDeleted v-if="isRepost && post.repostDeleted">
        <DeleteOutlined class="repost-deleted-icon" />
        <span>{{ t('postCard.repostDeleted') }}</span>
      </SC_RepostDeleted>

      <template v-else>
        <SC_RepostOriginalAuthor v-if="isRepost && post.repostAuthor">
          <router-link
            :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)"
            class="author-link"
          >
            <Avatar
              :src="post.repostAuthor.avatar"
              :alt="post.repostAuthor.name || post.repostAuthor.address"
              :fallback-text="post.repostAuthor.name || post.repostAuthor.address"
              :size="50"
            />
          </router-link>
          <SC_RepostOriginalAuthorInfo>
            <SC_RepostOriginalAuthorName>
              <router-link :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)">
                {{ post.repostAuthor.name || post.repostAuthor.address }}
              </router-link>
            </SC_RepostOriginalAuthorName>
            <SC_RepostOriginalAuthorTime v-if="originalAuthorFormattedTime">
              {{ originalAuthorFormattedTime }}
            </SC_RepostOriginalAuthorTime>
          </SC_RepostOriginalAuthorInfo>
        </SC_RepostOriginalAuthor>

        <PostCardImages v-if="post.images && post.images.length > 0" :images="post.images" />

        <VideoPlayer
          v-else-if="(post.type === 'video' || post.type === 'audio') && post.videoUrl"
          ref="videoPlayerRef"
          :video-url="post.videoUrl"
          :is-audio="post.type === 'audio'"
          :chapters="chapters"
          :title="decodedTitle || post.author?.name || 'Bastyon'"
          :artist="post.author?.name || ''"
        />

        <PostCardVideoPlaceholder v-else-if="post.type === 'video' || post.type === 'audio'" />

        <SC_PostTitle v-if="decodedTitle">
          {{ decodedTitle }}
        </SC_PostTitle>

        <PostCardContent
          :post="post"
          :max-length="maxLength"
          :max-blocks="maxBlocks"
          :show-full="showFull"
          :is-collapsed="isCollapsed"
          :chapters="chapters"
          @seek-timecode="handleSeekTimecode"
        />

        <SC_PostCardYoutube v-if="(youtubeEmbedUrls || []).length">
          <iframe
            v-for="embedUrl in youtubeEmbedUrls"
            :key="embedUrl"
            :src="embedUrl"
            title="YouTube video player"
            frameborder="0"
            allow="
              accelerometer;
              autoplay;
              clipboard-write;
              encrypted-media;
              gyroscope;
              picture-in-picture;
              web-share;
            "
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
        </SC_PostCardYoutube>

        <PostCardCategoriesTags :post="post" />

        <SC_PostActions>
          <StarRating
            v-if="post.hash || post.txid || post.id"
            :rating="averageRating"
            :user-vote="post.myVal"
            :voters-count="post.scoreCnt || 0"
            :score-sum="post.scoreSum || 0"
            :share-id="String(post.hash || post.txid || post.id || '')"
            :content-author-address="post.author?.address || ''"
            @rating-change="handleRatingChange"
            @error="handleRatingError"
          />

          <SC_PostActionBtn
            v-if="canRepost"
            type="button"
            :aria-label="t('postCard.repostAction')"
            @click="openRepost"
          >
            <RetweetOutlined />
            <span>{{ t('postCard.repostAction') }}</span>
          </SC_PostActionBtn>

          <Dropdown v-model:open="shareMenuOpen" :trigger="['click']" placement="bottomRight">
            <SC_PostActionBtn type="button" :aria-label="t('postCard.shareAction')">
              <ShareAltOutlined />
              <span>{{ t('postCard.shareAction') }}</span>
            </SC_PostActionBtn>
            <template #overlay>
              <PostShareMenu :url="postUrl" :text="shareText" @done="shareMenuOpen = false" />
            </template>
          </Dropdown>

          <SC_PostActionBtn
            v-if="isOwnPost"
            type="button"
            :aria-label="t('postCard.editAction')"
            @click="openEdit"
          >
            <EditOutlined />
            <span>{{ t('postCard.editAction') }}</span>
          </SC_PostActionBtn>

          <SC_PostActionBtn
            v-if="isOwnPost && canDelete"
            type="button"
            :disabled="deleting"
            :aria-label="t('postCard.deleteAction')"
            @click="confirmDelete"
          >
            <DeleteOutlined />
            <span>{{ t('postCard.deleteAction') }}</span>
          </SC_PostActionBtn>
        </SC_PostActions>

        <PostCardComments
          :post="post"
          :target-comment-id="targetCommentId"
          :target-parent-id="targetParentId"
          @collapsed="onCommentsCollapsed"
        />
      </template>
    </component>
  </SC_PostCard>

  <ImageGallery
    v-if="post.images && post.images.length > 0"
    v-model:visible="isImageGalleryOpen"
    :images="post.images"
    :initial-index="galleryIndex"
    @hide="closeImageGallery"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DeleteOutlined,
  ShareAltOutlined,
  EditOutlined,
  RetweetOutlined,
} from '@ant-design/icons-vue'
import { Dropdown, Modal } from 'ant-design-vue'
import PostShareMenu from '@/b-components/content/post-share-menu/post-share-menu.vue'
import { appToast } from '@/b-components/app-toast'
import { deletePost } from '@/b-components/content/post-card/post-deleter'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'
import { usePostsStore } from '@/stores/posts-store'
import { formatDateTimeFull } from '@/helpers/common/date-formatter'
import { getInitials } from '@/helpers/common/initials'
import { getYoutubeEmbedUrls } from '@/helpers/common/youtube-url'
import { parseTimecodes, type Chapter } from '@/helpers/content/timecode-parser'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import { ImageGallery } from '@/components/image-gallery'
import StarRating from '@/b-components/content/post-card/components/star-rating/star-rating.vue'
import PostCardComments from '@/b-components/content/post-card/components/post-card-comments/post-card-comments.vue'
import Avatar from '@/components/avatar/avatar.vue'
import PostCardHeader from '@/b-components/content/post-card/components/post-card-header/post-card-header.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import PostCardContent from '@/b-components/content/post-card/components/post-card-content/post-card-content.vue'
import PostCardCategoriesTags from '@/b-components/content/post-card/components/post-card-categories-tags/post-card-categories-tags.vue'
import PostCardVideoPlaceholder from '@/b-components/content/post-card/components/post-card-video-placeholder/post-card-video-placeholder.vue'
import {
  SC_PostCard,
  SC_PostTitle,
  SC_PostActions,
  SC_PostActionBtn,
  SC_PostCardYoutube,
  SC_RepostInnerCard,
  SC_RepostOriginalAuthor,
  SC_RepostOriginalAuthorInfo,
  SC_RepostOriginalAuthorName,
  SC_RepostOriginalAuthorTime,
  SC_RepostDeleted,
} from './styled'

interface PostAuthor {
  name: string
  address: string
  avatar?: string | null
  reputation: number
  letter: string
  verified?: boolean
  subscribers_count?: number
  subscribes_count?: number
}

interface Post {
  id?: string | number
  /** Хеш поста (share ID для upvote). */
  hash?: string
  /** ID транзакции (альтернатива hash). */
  txid?: string
  author: PostAuthor
  title?: string
  content?: string
  timestamp: string
  likes?: number
  comments?: number
  shares?: number
  tags?: string[]
  type?: string
  category?: string
  images?: string[]
  ratingStars?: number
  scoreCnt?: number
  scoreSum?: number
  /** Оценка текущего пользователя. */
  myVal?: number
  /** URL видео в формате peertube://host/videoid. */
  videoUrl?: string
  /** Текст превью для статей. */
  preview?: string
  lastComment?: {
    id: string
    address: string
    authorName: string
    avatar: string | null
    time: number
    message: string
    children: number
    scoreUp: number
    scoreDown: number
  }
  /** txid оригинальной записи (если репост). */
  repost?: string
  /** Автор оригинальной записи. */
  repostAuthor?: {
    name: string
    address: string
    avatar?: string | null
  }
  /** Время публикации оригинала (unix sec). */
  repostOriginalTimestamp?: number
  /** Оригинал удалён. */
  repostDeleted?: boolean
}

const props = withDefaults(
  defineProps<{
    post: Post
    /** Максимальная длина текста до сворачивания (символов). */
    maxLength?: number
    /** Максимальное количество блоков до сворачивания. */
    maxBlocks?: number
    /** Показывать ли текст полностью (отключает сворачивание). */
    showFull?: boolean
    authorOverride?: PostAuthor | null
    /** Deep-link: проскроллить/подсветить указанный комментарий (#40/#41). */
    targetCommentId?: string
    /** Deep-link: корневой коммент ветки, если цель — ответ. */
    targetParentId?: string
  }>(),
  { maxLength: 500, maxBlocks: 3, showFull: false, authorOverride: null }
)

const emit = defineEmits<{
  like: [postId: string | number]
  comment: [postId: string | number]
  share: [postId: string | number]
  deleted: [postId: string]
}>()

const { t } = useI18n()
const modalStore = useModalStore()
const postsStore = usePostsStore()
const authStore = useAuthStore()

const isCollapsed = ref(true)
const postCardRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const videoPlayerRef = ref<{ seekTo?: (s: number) => void } | null>(null)

onMounted(() => {
  if (props.post.id !== undefined) {
    postsStore.registerPost(props.post)
  }
})

const isRepost = computed<boolean>(() => !!props.post.repost)

/** Свой ли это пост (для показа кнопки редактирования). */
const isOwnPost = computed<boolean>(
  () => !!props.post.author?.address && props.post.author.address === authStore.getUserAddress
)
/** Можно ли репостить (не показываем для удалённого оригинала). */
const canRepost = computed<boolean>(() => !props.post.repostDeleted)

function openRepost(): void {
  modalStore.openPostComposerModal({ mode: 'repost', source: props.post })
}
function openEdit(): void {
  modalStore.openPostComposerModal({ mode: 'edit', source: props.post })
}

// ── Удаление своего поста (contentDelete) ───────────────────────────
const deleting = ref(false)
const deleted = ref(false)
// Удалять можно только при наличии реального txid/hash поста — числовой
// surrogate-id не годится для contentDelete (хеш не совпадёт с оригиналом).
const canDelete = computed<boolean>(() => !!(props.post.txid || props.post.hash))

function confirmDelete(): void {
  Modal.confirm({
    title: t('postCard.deleteConfirmTitle'),
    content: t('postCard.deleteConfirmText'),
    okText: t('postCard.deleteAction'),
    okType: 'danger',
    cancelText: t('postCard.deleteCancel'),
    onOk: doDelete,
  })
}

async function doDelete(): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  try {
    await deletePost(postId.value)
    deleted.value = true
    appToast.success({ message: t('postCard.deleted') })
    emit('deleted', postId.value)
  } catch (e) {
    appToast.error({ message: e instanceof Error ? e.message : t('postCard.deleteFailed') })
  } finally {
    deleting.value = false
  }
}

const postId = computed<string>(
  () => props.post.txid || props.post.hash || String(props.post.id || '')
)

// ── Внешний шаринг поста ────────────────────────────────────────────
const shareMenuOpen = ref(false)
const postUrl = computed<string>(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/post/${postId.value}`
})
const shareText = computed<string>(
  () => decodeUrlEncoded(props.post.title || '') || props.post.author?.name || 'Bastyon'
)

const isImageGalleryOpen = computed<boolean>({
  get: () => modalStore.imageGallery.isOpen && modalStore.imageGallery.images === props.post.images,
  set: (value) => {
    if (!value) modalStore.closeImageGallery()
  },
})

const galleryIndex = computed<number>(() => modalStore.imageGallery.index)

/** Средний рейтинг в звёздах (0-5). */
const averageRating = computed<number>(() => {
  if (props.post.ratingStars != null) return props.post.ratingStars
  if (
    props.post.scoreCnt &&
    props.post.scoreCnt > 0 &&
    props.post.scoreSum != null &&
    props.post.scoreSum !== undefined
  ) {
    const averageRating = props.post.scoreSum / props.post.scoreCnt
    return Math.max(0, Math.min(5, Math.round(averageRating * 10) / 10))
  }
  return 0
})

function decodeUrlEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str
  // Префильтр — без %XX декодировать смысла нет.
  const urlEncodedPattern = /%[0-9A-Fa-f]{2}/g
  if (!urlEncodedPattern.test(str)) return str
  try {
    const decoded = decodeURIComponent(str)
    if (decoded && decoded !== str) return decoded
  } catch {
    return str
  }
  return str
}

const decodedTitle = computed<string>(() => decodeUrlEncoded(props.post.title || ''))

const originalAuthorFormattedTime = computed<string>(() => {
  const ts = props.post.repostOriginalTimestamp
  if (ts == null) return ''
  return formatDateTimeFull(ts)
})

/** Главы из тайм-кодов в описании (для video/audio постов). */
const chapters = computed<Chapter[]>(() => {
  const isMedia =
    (props.post.type === 'video' || props.post.type === 'audio') && !!props.post.videoUrl
  if (!isMedia) return []
  return parseTimecodes(props.post.content)
})

const youtubeEmbedUrls = computed<string[]>(() => {
  if (!props.post) return []
  // Не показываем YouTube-эмбеды, если пост содержит внутриплатформенное видео —
  // это привело бы к двум плеерам.
  const hasInPlatformVideo =
    (props.post.type === 'video' || props.post.type === 'audio') && !!props.post.videoUrl
  if (hasInPlatformVideo) return []
  const fromContent = getYoutubeEmbedUrls(props.post.content)
  const fromPreview = getYoutubeEmbedUrls(props.post.preview)
  const seen = new Set(fromContent)
  for (const url of fromPreview) seen.add(url)
  return Array.from(seen)
})

function getInitial(nameOrLetter?: string): string {
  return getInitials(nameOrLetter, { maxLetters: 1 })
}

function closeImageGallery(): void {
  modalStore.closeImageGallery()
}

function handleLike(): void {
  postsStore.likePost(postId.value)
  emit('like', postId.value)
}

function handleComment(): void {
  postsStore.commentPost(postId.value)
  emit('comment', postId.value)
}

function handleShare(): void {
  postsStore.sharePost(postId.value)
  emit('share', postId.value)
}

function handleRatingChange(_rating: number): void {
  // Оптимистичное состояние держится в composable (`optimisticRating` +
  // `pendingValue`). Мутировать `post.myVal` здесь нельзя: это делает
  // `effectiveUserVote` правдивым до подтверждения транзакции — из-за чего
  // `optimisticVotersCount` / `scoreSum` откатывают +1 обратно. `myVal`,
  // `scoreCnt`, `scoreSum` обновятся атомарно в store после поллинга
  // подтверждения в `pending-ratings-store`.
}

function handleRatingError(error: unknown): void {
  console.error('Failed to submit rating:', error)
}

/** Клик по тайм-коду в описании → плеер перематывает и запускает. */
function handleSeekTimecode(seconds: number): void {
  const player = videoPlayerRef.value
  if (player && typeof player.seekTo === 'function') {
    player.seekTo(seconds)
  }
}

/** При сворачивании комментариев скроллим к карточке поста. */
function onCommentsCollapsed(): void {
  nextTick(() => {
    const r = postCardRef.value
    const el = r && ('$el' in r ? r.$el : r)
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      ;(el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

// Подавляем «unused»-предупреждение TS — функции используются как обработчики.
void handleLike
void handleComment
void handleShare
void getInitial
</script>
