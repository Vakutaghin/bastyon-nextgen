<template>
  <Button
    v-if="store.available && media.length"
    :loading="!!batchProgress"
    :disabled="allMine"
    data-testid="offline-download-all"
    @click="onClick"
  >
    <template v-if="!batchProgress" #icon>
      <CheckCircleFilled v-if="allMine" />
      <DownloadOutlined v-else />
    </template>
    {{ label }}
  </Button>
</template>

<script setup lang="ts">
// «Скачать всё» у коллекции, плейлиста и личного списка: все ролики и треки в
// «Скачанное» с одним качеством на всех. Всё уже скачано или качается —
// кнопка говорит об этом и не нажимается.

import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from 'ant-design-vue'
import { CheckCircleFilled, DownloadOutlined } from '@/components/icons'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import {
  offlineSourceFromPost,
  useOfflineDownload,
  type OfflinePostLike,
} from './use-offline-download'

const props = withDefaults(
  defineProps<{
    /** Показанные посты: по ним — «всё скачано». */
    posts: readonly OfflinePostLike[]
    /** Все посты списка, если показаны не все. */
    resolve?: () => Promise<readonly OfflinePostLike[]>
    /** Показаны все посты списка — можно сказать «всё скачано». */
    complete?: boolean
  }>(),
  { resolve: undefined, complete: true }
)

const { t } = useI18n()
const store = useOfflineVideosStore()
const { batchProgress, downloadAll } = useOfflineDownload()

onMounted(() => void store.hydrate())

const media = computed(() => props.posts.filter((p) => !!offlineSourceFromPost(p)))
const mine = computed(() => media.value.map((p) => store.mineFor(p.videoUrl)))
const allMine = computed(() => props.complete && mine.value.every((item) => !!item))
const allDone = computed(
  () => allMine.value && mine.value.every((item) => item?.state.status === 'done')
)

function onClick(): void {
  downloadAll(props.resolve ?? (() => Promise.resolve(props.posts)))
}

const label = computed(() => {
  const progress = batchProgress.value
  if (progress)
    return progress.total
      ? t('offlineVideo.batchPreparing', { done: progress.done, total: progress.total })
      : t('offlineVideo.downloadAll')
  if (allDone.value) return t('offlineVideo.allDownloaded')
  if (allMine.value) return t('offlineVideo.allQueued')
  return t('offlineVideo.downloadAll')
})
</script>
