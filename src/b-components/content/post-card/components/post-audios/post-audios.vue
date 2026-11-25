<template>
  <SC_Album data-testid="post-audios">
    <SC_AlbumHead>
      <SC_AlbumCover
        type="button"
        :aria-label="playing ? t('media.pause') : t('media.play')"
        data-testid="post-audios-play"
        @click="toggleMain"
      >
        <img v-if="cover && !coverFailed" :src="cover" alt="" @error="coverFailed = true" />
        <span class="overlay" aria-hidden="true">
          <LoadingOutlined v-if="isCurrent && state.loading && !state.error" spin />
          <PauseIcon v-else-if="playing" />
          <PlayIcon v-else />
        </span>
      </SC_AlbumCover>

      <SC_AlbumInfo>
        <span class="now" :title="nowTitle">{{ nowTitle }}</span>
        <template v-if="isCurrent">
          <span v-if="state.error" class="error" role="alert">{{ state.error }}</span>
          <template v-else>
            <SC_Seek
              type="range"
              min="0"
              step="1"
              :max="duration || 0"
              :value="state.position"
              :progress="progress"
              :aria-label="t('media.position')"
              @input="onSeek"
            />
            <span class="meta">
              {{ formatDuration(state.position) || '0:00'
              }}<template v-if="duration"> / {{ formatDuration(duration) }}</template>
            </span>
          </template>
        </template>
        <span v-else class="meta">
          {{ t('media.parts', { n: list.length }, list.length)
          }}<template v-if="total"> · {{ formatDuration(total) }}</template>
        </span>
      </SC_AlbumInfo>
    </SC_AlbumHead>

    <!-- Мини-плеер с тем же вопросом бывает закрыт окном поста. -->
    <SC_Tor v-if="isCurrent && state.torBlocked" role="status">
      <span>{{ t('torMedia.audioBypassBody') }}</span>
      <Button size="small" @click="acceptTorBypass">{{ t('torMedia.audioBypassOk') }}</Button>
    </SC_Tor>

    <PostAudioRows
      :audios="list"
      :current="currentIndex"
      :playing="playing"
      :expanded="expanded"
      @select="select"
    />
  </SC_Album>
</template>

<script setup lang="ts">
// Аудио-пост с несколькими записями — аудиокнига, альбом. Играет мини-плеер:
// записи встают в его очередь, поэтому они идут подряд и в свёрнутом
// приложении, место в длинной записи помнится, а сама книга продолжается с
// главы, на которой остановились.

import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/button'
import { LoadingOutlined, PauseIcon, PlayIcon } from '@/components/icons'
import { useAuthStore } from '@/blockchain'
import { usePlayback } from '@/composables/use-playback'
import { totalDuration, type PostAudio } from '@/helpers/content/post-audios'
import { acceptTorBypass, audioState, seek, toggle } from '@/services/media/audio-engine'
import { savedPart } from '@/services/media/audio-positions'
import { fetchMediaInfo, type MediaInfo } from '@/services/media/media-info'
import { formatDuration, postId, toQueueItems } from '@/services/media/media-post'
import { queuePostId } from '@/stores/playback-queue-store'
import type { AdaptedPost } from '@/types/adapted-post'
import PostAudioRows from './post-audio-rows.vue'
import {
  SC_Album,
  SC_AlbumCover,
  SC_AlbumHead,
  SC_AlbumInfo,
  SC_Seek,
  SC_Tor,
} from './post-audios.styled'

const props = defineProps<{
  post: AdaptedPost
  audios: PostAudio[]
  /** Заголовок поста — подпись очереди в мини-плеере. */
  title: string
  /** Весь список сразу (страница поста). */
  expanded?: boolean
  /** Играть сразу: пост открыли нажатием на воспроизведение. */
  autoplay?: boolean
}>()

const { t } = useI18n()
const { queue, playAll } = usePlayback()
const authStore = useAuthStore()
const state = audioState

/** Обложка и длительности, которых нет в посте, — от ноды. */
const info = shallowRef<Map<string, MediaInfo>>(new Map())
const coverFailed = ref(false)

const id = computed(() => postId(props.post))
const list = computed<PostAudio[]>(() =>
  props.audios.map((audio) => ({
    ...audio,
    duration: audio.duration ?? info.value.get(audio.url)?.duration ?? null,
  }))
)
const total = computed(() => totalDuration(list.value))
const cover = computed(
  () => info.value.get(props.audios[0]?.url ?? '')?.thumbnail ?? props.post.images?.[0] ?? null
)

const items = computed(() =>
  toQueueItems(
    { ...props.post, audios: list.value },
    info.value.get(props.audios[0]?.url ?? '') ?? null
  )
)

/** Играет (или стоит на паузе) запись этого поста. */
const isCurrent = computed(
  () =>
    queue.current?.type === 'audio' &&
    !!queue.current.postId &&
    queuePostId(queue.current) === id.value
)
const currentIndex = computed(() =>
  isCurrent.value ? items.value.findIndex((item) => item.id === queue.current?.id) : -1
)
const playing = computed(() => isCurrent.value && state.playing)
const duration = computed(() => state.duration || list.value[currentIndex.value]?.duration || 0)
const progress = computed(() =>
  duration.value ? Math.round(Math.min(100, (state.position / duration.value) * 100)) : 0
)

const partTitle = (index: number): string =>
  list.value[index]?.title || t('media.partN', { n: index + 1 })

/** С какой записи продолжить: на ней остановились в прошлый раз. */
const resumeIndex = ref(0)
function refreshResume(): void {
  const part = savedPart(authStore.getUserAddress || null, id.value)
  resumeIndex.value = Math.max(
    0,
    items.value.findIndex((item) => item.id === part)
  )
}

refreshResume()
// Включили другое — вернутся сюда на ту же запись.
watch(isCurrent, (current) => {
  if (!current) refreshResume()
})

const nowTitle = computed(() => {
  if (currentIndex.value >= 0) return partTitle(currentIndex.value)
  return resumeIndex.value > 0
    ? t('media.continuePart', { title: partTitle(resumeIndex.value) })
    : partTitle(0)
})

function start(index: number): void {
  // Главы — по порядку: «Перемешать», включённое для музыки, здесь ни к чему.
  if (queue.shuffle) queue.toggleShuffle()
  playAll(items.value, index, { title: props.title, path: `/post/${id.value}` })
}

function select(index: number): void {
  if (index === currentIndex.value) toggle()
  else start(index)
}

function toggleMain(): void {
  if (currentIndex.value >= 0) {
    toggle()
    return
  }
  start(resumeIndex.value)
}

function onSeek(event: Event): void {
  seek(Number((event.target as HTMLInputElement).value))
}

onMounted(() => {
  if (props.autoplay && !isCurrent.value) start(resumeIndex.value)
  const unknown = props.audios.filter((audio) => !audio.duration).map((audio) => audio.url)
  const urls = [props.audios[0]?.url ?? '', ...unknown].filter(Boolean)
  void fetchMediaInfo(urls).then((found) => {
    if (found.size) info.value = found
  })
})
</script>
