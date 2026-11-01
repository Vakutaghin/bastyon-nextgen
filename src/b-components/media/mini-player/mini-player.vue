<template>
  <SC_MiniPlayer
    v-if="visible && current"
    :class="{ compact: isMobileOrTablet }"
    role="region"
    :aria-label="t('media.player')"
    data-testid="mini-player"
  >
    <SC_Progress
      type="range"
      min="0"
      :max="duration || 0"
      step="1"
      :value="state.position"
      :aria-label="t('media.position')"
      :progress="progressPercent"
      @input="onSeek"
    />

    <SC_Body>
      <SC_Cover type="button" :aria-label="t('media.openPost')" @click="openPost">
        <img
          v-if="current.cover && !coverFailed"
          :src="current.cover"
          alt=""
          @error="coverFailed = true"
        />
        <MusicIcon v-else />
      </SC_Cover>

      <SC_TorNote v-if="state.torBlocked" role="status" data-testid="mini-player-tor">
        <span>{{ t('torMedia.audioBypassBody') }}</span>
        <Button size="small" @click="acceptTorBypass">{{ t('torMedia.audioBypassOk') }}</Button>
      </SC_TorNote>
      <SC_Info v-else type="button" :title="current.title" @click="openPost">
        <SC_Title>{{ current.title || t('media.untitled') }}</SC_Title>
        <SC_Artist>
          <template v-if="state.error">{{ state.error }}</template>
          <template v-else>
            {{ current.artist }}
            <SC_Time v-if="duration">
              · {{ formatDuration(state.position) || '0:00' }} / {{ formatDuration(duration) }}
            </SC_Time>
          </template>
        </SC_Artist>
      </SC_Info>

      <SC_Controls>
        <SC_Control type="button" class="prev" :aria-label="t('media.previous')" @click="back">
          <SkipBackIcon />
        </SC_Control>
        <SC_Control
          type="button"
          class="main"
          :aria-label="state.playing ? t('media.pause') : t('media.play')"
          data-testid="mini-player-toggle"
          @click="toggle"
        >
          <LoadingOutlined v-if="state.loading && !state.error" spin />
          <PauseIcon v-else-if="state.playing" />
          <PlayIcon v-else />
        </SC_Control>
        <SC_Control
          type="button"
          :disabled="!queue.hasNext"
          :aria-label="t('media.next')"
          @click="next"
        >
          <SkipForwardIcon />
        </SC_Control>
        <SC_Control
          type="button"
          class="secondary"
          :class="{ on: listOpen }"
          :aria-label="t('media.queue')"
          :aria-expanded="listOpen"
          @click="listOpen = !listOpen"
        >
          <AudioPlaylistIcon />
        </SC_Control>
        <!-- Закрыть — через меню: крестик рядом с «Далее» нажимали случайно. -->
        <Dropdown :trigger="['click']" placement="topRight">
          <SC_Control
            type="button"
            class="secondary"
            :aria-label="t('media.more')"
            data-testid="mini-player-more"
          >
            <MoreOutlined />
          </SC_Control>
          <template #overlay>
            <Menu :items="moreItems" @click="onMore" />
          </template>
        </Dropdown>
      </SC_Controls>
    </SC_Body>

    <SC_Queue v-if="listOpen" data-testid="mini-player-queue">
      <SC_QueueHead>
        <SC_QueueTitle>
          <button
            v-if="queue.source?.path"
            type="button"
            :title="t('media.openPlaylist')"
            data-testid="mini-player-source"
            @click="openSource"
          >
            {{ queue.source.title || t('media.queue') }}
          </button>
          <template v-else>{{ queue.source?.title || t('media.queue') }}</template>
        </SC_QueueTitle>
        <SC_Control
          type="button"
          class="secondary"
          :class="{ on: queue.shuffle }"
          :aria-pressed="queue.shuffle"
          :aria-label="t('media.shuffle')"
          :title="t('media.shuffle')"
          @click="queue.toggleShuffle()"
        >
          <ShuffleIcon />
        </SC_Control>
        <SC_Control
          type="button"
          class="secondary"
          :class="{ on: queue.repeat !== 'off' }"
          :aria-label="repeatLabel"
          :title="repeatLabel"
          @click="queue.cycleRepeat()"
        >
          <RepeatOneIcon v-if="queue.repeat === 'one'" />
          <RepeatIcon v-else />
        </SC_Control>
      </SC_QueueHead>
      <SC_QueueList>
        <li v-for="index in queue.order" :key="queue.items[index]?.id ?? index">
          <SC_QueueRow
            v-if="queue.items[index]"
            type="button"
            :class="{ current: index === queue.currentIndex }"
            @click="jump(index)"
          >
            <span class="title">{{ queue.items[index]!.title || t('media.untitled') }}</span>
            <span class="artist">{{ queue.items[index]!.artist }}</span>
            <span class="duration">{{ formatDuration(queue.items[index]!.duration) }}</span>
          </SC_QueueRow>
        </li>
      </SC_QueueList>
    </SC_Queue>
  </SC_MiniPlayer>
</template>

<script setup lang="ts">
// Мини-плеер: трек из очереди играет, пока человек ходит по приложению.
// Логика — в use-mini-player, звук — в services/media/audio-engine.

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  AudioPlaylistIcon,
  CloseOutlined,
  LoadingOutlined,
  MoreOutlined,
  PauseIcon,
  PlayIcon,
  MusicIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from '@/components/icons'
import { Button, Dropdown, Menu } from 'ant-design-vue'
import { formatDuration } from '@/services/media/media-post'
import { acceptTorBypass } from '@/services/media/audio-engine'
import { playlistMenuItems } from './playlist-menu'
import { useViewport } from '@/composables/use-viewport'
import { useMiniPlayer } from './use-mini-player'
import {
  SC_Artist,
  SC_Body,
  SC_Control,
  SC_Controls,
  SC_Cover,
  SC_Info,
  SC_MiniPlayer,
  SC_Progress,
  SC_Queue,
  SC_QueueHead,
  SC_QueueList,
  SC_QueueRow,
  SC_QueueTitle,
  SC_Time,
  SC_Title,
  SC_TorNote,
} from './mini-player.styled'

const { t } = useI18n()
const router = useRouter()
const { queue, current, visible, state, toggle, seek, next, back, jump, close } = useMiniPlayer()

/** Меню «⋯»: открыть плейлист, откуда очередь, и закрыть плеер. */
const moreItems = computed(() =>
  playlistMenuItems({
    openLabel: queue.source?.path ? t('media.openPlaylist') : null,
    closeLabel: t('media.close'),
    closeIcon: CloseOutlined,
  })
)

function onMore({ key }: { key: string | number }): void {
  if (key === 'open') openSource()
  else if (key === 'close') close()
}

/** Название очереди ведёт на сам плейлист (коллекцию, список, раздел). */
function openSource(): void {
  const path = queue.source?.path
  if (path) void router.push(path)
}

const { isMobileOrTablet } = useViewport()
const listOpen = ref(false)
const coverFailed = ref(false)
watch(
  () => current.value?.id,
  () => (coverFailed.value = false)
)

const duration = computed(() => state.duration || current.value?.duration || 0)
const progressPercent = computed(() =>
  duration.value ? Math.round(Math.min(100, (state.position / duration.value) * 100)) : 0
)

const repeatLabel = computed(() =>
  queue.repeat === 'one'
    ? t('media.repeatOne')
    : queue.repeat === 'all'
      ? t('media.repeatAll')
      : t('media.repeatOff')
)

// Место под плеер внизу: последние строки страницы не прячутся за ним.
watch(
  visible,
  (on) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('has-mini-player', on)
  },
  { immediate: true }
)

function onSeek(e: Event): void {
  seek(Number((e.target as HTMLInputElement).value))
}

function openPost(): void {
  if (current.value) void router.push({ name: 'post', params: { txid: current.value.id } })
}
</script>
