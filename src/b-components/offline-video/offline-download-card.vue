<template>
  <SC_Card
    :class="{ done }"
    data-testid="offline-card"
    :data-status="item.state.status"
    :role="done ? 'button' : undefined"
    :tabindex="done ? 0 : undefined"
    @click="done && store.openPlayer(item.id)"
    @keydown.enter="done && store.openPlayer(item.id)"
  >
    <SC_Thumb>
      <img v-if="thumb && !thumbFailed" :src="thumb" alt="" @error="thumbFailed = true" />
      <SoundOutlined v-else-if="item.meta.kind === 'audio'" />
      <PlayCircleOutlined v-else />
      <span v-if="durationText" class="duration">{{ durationText }}</span>
    </SC_Thumb>
    <SC_CardBody>
      <SC_CardTitle>{{ item.meta.title || t('media.untitled') }}</SC_CardTitle>
      <SC_CardMeta>{{ authorName }}</SC_CardMeta>
      <SC_CardStatus :class="statusClass">
        <span>{{ statusText }}</span>
        <SC_Deleted v-if="item.meta.authorDeleted" data-testid="offline-author-deleted">
          <DeleteOutlined /> {{ t('offlineVideo.authorDeleted') }}
        </SC_Deleted>
      </SC_CardStatus>
      <SC_Progress v-if="showProgress" :value="received" :max="total || 1" />
      <SC_CardActions @click.stop>
        <Button v-if="active" size="small" @click="store.pause(item.id)">
          {{ t('offlineVideo.pause') }}
        </Button>
        <Button
          v-else-if="item.state.status === 'paused'"
          size="small"
          @click="store.resume(item.id)"
        >
          {{ t('offlineVideo.resume') }}
        </Button>
        <Button
          v-else-if="item.state.status === 'failed'"
          size="small"
          type="primary"
          @click="store.resume(item.id)"
        >
          {{ t('offlineVideo.retry') }}
        </Button>
        <Button size="small" danger data-testid="offline-remove" @click="store.remove(item.id)">
          {{ done ? t('offlineVideo.remove') : t('offlineVideo.cancel') }}
        </Button>
      </SC_CardActions>
    </SC_CardBody>
  </SC_Card>
</template>

<script setup lang="ts">
// Карточка в «Скачанном»: обложка с диска, ход загрузки, причина паузы,
// «Повторить» и «Удалить». Скачанный ролик открывается окном без сети.

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { DeleteOutlined, PlayCircleOutlined, SoundOutlined } from '@/components/icons'
import { formatDuration } from '@/services/media/media-post'
import { userName } from '@/services/user-names'
import type { OfflineItem } from '@/services/offline-video/types'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { offlineStatusText } from './offline-status'
import { useOfflineFile } from './use-offline-file'
import {
  SC_Card,
  SC_CardActions,
  SC_CardBody,
  SC_CardMeta,
  SC_CardStatus,
  SC_CardTitle,
  SC_Deleted,
  SC_Progress,
  SC_Thumb,
} from './offline-video.styled'

const props = defineProps<{ item: OfflineItem }>()

const { t, locale } = useI18n()
const store = useOfflineVideosStore()
const thumb = useOfflineFile(() => props.item, 'thumb.jpg')
const thumbFailed = ref(false)

const done = computed(() => props.item.state.status === 'done')
const active = computed(
  () => props.item.state.status === 'downloading' || props.item.state.status === 'queued'
)
const progress = computed(() => store.progress.get(props.item.id))
const received = computed(() => progress.value?.received ?? props.item.state.received)
const total = computed(
  () => progress.value?.total || props.item.state.total || props.item.meta.size || 0
)
const showProgress = computed(() => !done.value && props.item.state.status !== 'failed')
const durationText = computed(() => formatDuration(props.item.meta.duration))
const authorName = computed(() =>
  userName(props.item.meta.author.address, props.item.meta.author.name)
)
const statusText = computed(() => offlineStatusText(t, locale.value, props.item, progress.value))
const statusClass = computed(() => {
  if (props.item.state.status === 'failed') return 'error'
  if (props.item.state.status === 'paused' && props.item.state.error) return 'warn'
  return ''
})
</script>
