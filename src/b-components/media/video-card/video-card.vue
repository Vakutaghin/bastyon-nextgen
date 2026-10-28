<template>
  <SC_Card :class="{ current }" data-testid="video-card">
    <router-link v-slot="{ href, navigate }" :to="to" custom>
      <SC_ThumbLink :href="href" :aria-label="title" @click="onOpen($event, navigate)">
        <img v-if="thumbSrc" :src="thumbSrc" alt="" loading="lazy" @error="onThumbError" />
        <SC_ThumbFallback v-else><PlayCircleOutlined /></SC_ThumbFallback>
        <SC_Duration v-if="duration">{{ duration }}</SC_Duration>
        <SC_Badge v-if="badge">{{ badge }}</SC_Badge>
      </SC_ThumbLink>
    </router-link>

    <SC_Info>
      <router-link :to="authorPath" class="avatar" :aria-label="artist">
        <Avatar :src="avatar" :alt="artist" :fallback-text="artist" :size="32" />
      </router-link>
      <SC_Text>
        <router-link v-slot="{ href, navigate }" :to="to" custom>
          <SC_Title :href="href" :title="title" @click="onOpen($event, navigate)">
            {{ title || t('media.untitled') }}
          </SC_Title>
        </router-link>
        <router-link :to="authorPath" class="author">{{ artist }}</router-link>
        <SC_Meta>{{ meta }}</SC_Meta>
      </SC_Text>
      <MediaItemMenu :post="post" />
    </SC_Info>
  </SC_Card>
</template>

<script setup lang="ts">
// Карточка ролика в сетке раздела «Видео», профиля и плейлиста: превью,
// длительность, название, автор, просмотры и дата. Нажатие открывает пост —
// или, если задан `@play`, запускает очередь.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PlayCircleOutlined } from '@/components/icons'
import Avatar from '@/components/avatar/avatar.vue'
import { formatCompact, formatStudioDate } from '@/pages/my-videos-page/studio-format'
import {
  formatDuration,
  mediaArtist,
  mediaCover,
  mediaTitle,
  postId,
} from '@/services/media/media-post'
import { useThumbnailFallback } from '@/composables/use-thumbnail-fallback'
import type { MediaInfo } from '@/services/media/media-info'
import type { AdaptedPost } from '@/types/adapted-post'
import MediaItemMenu from '../media-item-menu/media-item-menu.vue'
import {
  SC_Badge,
  SC_Card,
  SC_Duration,
  SC_Info,
  SC_Meta,
  SC_Text,
  SC_ThumbFallback,
  SC_ThumbLink,
  SC_Title,
} from './video-card.styled'

const props = defineProps<{
  post: AdaptedPost
  info?: MediaInfo | null
  /** Сейчас играет (в очереди). */
  current?: boolean
  /** Подпись поверх превью: «Публикуется», номер в плейлисте. */
  badge?: string
  /** Нажатие запускает очередь (`@play`), а не просто открывает пост. */
  playable?: boolean
}>()

const emit = defineEmits<{ play: [] }>()

const { t } = useI18n()

const to = computed(() => `/post/${postId(props.post)}`)
const title = computed(() => mediaTitle(props.post))
const artist = computed(() => mediaArtist(props.post))
const cover = computed(() => mediaCover(props.post, props.info))
// Превью не загрузилось — ищем ролик, как плеер, потом заглушка.
const { src: thumbSrc, onError: onThumbError } = useThumbnailFallback(
  () => cover.value,
  () => props.post.videoUrl
)
const duration = computed(() => formatDuration(props.info?.duration))
const avatar = computed(() => props.post.author?.avatar || undefined)
const authorPath = computed(() => `/${props.post.author?.name || props.post.author?.address || ''}`)

const meta = computed(() => {
  const parts: string[] = []
  const views = props.info?.views
  if (typeof views === 'number') parts.push(t('media.views', { n: formatCompact(views) }, views))
  const ms = Date.parse(props.post.timestamp)
  if (Number.isFinite(ms)) parts.push(formatStudioDate(ms))
  return parts.join(' · ')
})

/** Модификаторы — как у ссылки (новая вкладка); обычный клик — очередь, если её ждут. */
function onOpen(e: MouseEvent, navigate: (e?: MouseEvent) => unknown): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  // Родитель запустит очередь и сам откроет пост.
  if (props.playable) emit('play')
  else void navigate(e)
}
</script>
