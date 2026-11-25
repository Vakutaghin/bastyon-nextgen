<template>
  <SC_PostActionBtn
    v-if="!item"
    type="button"
    :disabled="preparing"
    :aria-label="t('offlineVideo.download')"
    data-testid="offline-download"
    @click="start"
  >
    <LoadingOutlined v-if="preparing" spin />
    <DownloadOutlined v-else />
    <span>{{ t('offlineVideo.download') }}</span>
  </SC_PostActionBtn>

  <Dropdown v-else v-model:open="menuOpen" :trigger="['click']" placement="bottomRight">
    <SC_PostActionBtn
      type="button"
      :aria-label="label"
      :title="statusText"
      data-testid="offline-download"
      :data-status="item.state.status"
    >
      <CheckCircleFilled v-if="item.state.status === 'done'" />
      <OfflineRing
        v-else-if="item.state.status === 'downloading' || item.state.status === 'queued'"
        :value="fraction"
      />
      <ReloadOutlined v-else-if="item.state.status === 'failed'" />
      <PauseCircleOutlined v-else />
      <span>{{ label }}</span>
    </SC_PostActionBtn>
    <template #overlay>
      <Menu :items="menuItems" @click="onMenu" />
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
// Кнопка под роликом, как у YouTube: «Скачать» → кольцо с процентом →
// «Скачано». Во время загрузки — пауза и отмена, после — «Удалить загрузку».

import { computed, h, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Dropdown from '@/components/dropdown'
import Menu from '@/components/menu'
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayIcon,
  ReloadOutlined,
  SaveOutlined,
} from '@/components/icons'
import { SC_PostActionBtn } from '@/b-components/content/post-card/styled'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import type { OfflineItem } from '@/services/offline-video/types'
import OfflineRing from './offline-ring.vue'
import { offlineFraction, offlinePercent, offlineStatusText } from './offline-status'
import { useSaveOfflineFile } from './use-save-offline-file'
import {
  offlineSourcesFromPost,
  useOfflineDownload,
  type OfflinePostLike,
} from './use-offline-download'

const props = defineProps<{ post: OfflinePostLike }>()

const { t, locale } = useI18n()
const router = useRouter()
const store = useOfflineVideosStore()
const { busy, download, batchProgress, downloadAll } = useOfflineDownload()
const { save } = useSaveOfflineFile()
const menuOpen = ref(false)

/** Что скачивать: у аудиокниги — каждая запись. */
const sources = computed(() => offlineSourcesFromPost(props.post))
const many = computed(() => sources.value.length > 1)
const preparing = computed(() => busy.value || !!batchProgress.value)
const mine = computed(() => sources.value.map((source) => store.mineFor(source.peertubeUrl)))
const doneCount = computed(() => mine.value.filter((it) => it?.state.status === 'done').length)
/**
 * Чьё состояние на кнопке: у нескольких записей — первой недокачанной; пока
 * скачаны не все, предлагаем «Скачать» остальные.
 */
const item = computed(() => {
  if (!many.value) return mine.value[0] ?? null
  if (mine.value.some((it) => !it)) return null
  return mine.value.find((it) => it?.state.status !== 'done') ?? mine.value[0] ?? null
})

function start(): void {
  if (many.value) downloadAll(() => Promise.resolve([props.post]))
  else download(sources.value[0] ?? null)
}
const progress = computed(() => (item.value ? store.progress.get(item.value.id) : undefined))
const fraction = computed(() =>
  offlineFraction(
    progress.value?.received ?? item.value?.state.received ?? 0,
    progress.value?.total || item.value?.state.total || item.value?.meta.size || 0
  )
)

const statusText = computed(() =>
  item.value ? offlineStatusText(t, locale.value, item.value, progress.value) : ''
)

const label = computed<string>(() => {
  const it = item.value
  if (!it) return t('offlineVideo.download')
  switch (it.state.status) {
    case 'done':
      return t('offlineVideo.downloaded')
    case 'queued':
      return t('offlineVideo.queuedShort')
    case 'downloading': {
      if (many.value) return `${doneCount.value}/${mine.value.length}`
      const total = progress.value?.total || it.state.total || it.meta.size
      return offlinePercent(progress.value?.received ?? it.state.received, total) || '…'
    }
    case 'failed':
      return t('offlineVideo.retry')
    case 'paused':
      return t('offlineVideo.pausedShort')
  }
  return ''
})

const icon = (c: Component) => () => h(c)

interface MenuItem {
  key: string
  label: string
  icon: () => ReturnType<typeof h>
  danger?: boolean
}

/** Пункты одной записи: пауза, просмотр, файл. */
function itemActions(it: OfflineItem): MenuItem[] {
  switch (it.state.status) {
    case 'downloading':
    case 'queued':
      return [{ key: 'pause', label: t('offlineVideo.pause'), icon: icon(PauseCircleOutlined) }]
    case 'paused':
      return [{ key: 'resume', label: t('offlineVideo.resume'), icon: icon(PlayIcon) }]
    case 'failed':
      return [{ key: 'resume', label: t('offlineVideo.retry'), icon: icon(ReloadOutlined) }]
    case 'done':
      return [
        { key: 'play', label: t('offlineVideo.play'), icon: icon(PlayIcon) },
        { key: 'save', label: t('offlineVideo.saveFile'), icon: icon(SaveOutlined) },
      ]
    default:
      return []
  }
}

const menuItems = computed<MenuItem[]>(() => {
  const it = item.value
  if (!it) return []
  return [
    // У аудиокниги они свои у каждой записи — на странице загрузок.
    ...(many.value ? [] : itemActions(it)),
    {
      key: 'downloads',
      label: t('offlineVideo.openDownloads'),
      icon: icon(DownloadOutlined),
    },
    {
      key: 'remove',
      label: it.state.status === 'done' ? t('offlineVideo.remove') : t('offlineVideo.cancel'),
      icon: icon(DeleteOutlined),
      danger: true,
    },
  ]
})

/** У аудиокниги — все записи сразу. */
function removeAll(): void {
  for (const one of mine.value) if (one) void store.remove(one.id)
}

function onMenu({ key }: { key: string | number }): void {
  menuOpen.value = false
  const it = item.value
  if (!it) return
  if (key === 'pause') void store.pause(it.id)
  else if (key === 'resume') void store.resume(it.id)
  else if (key === 'remove') removeAll()
  else if (key === 'play') store.openPlayer(it.id)
  else if (key === 'save') void save(it)
  else if (key === 'downloads') {
    void router.push(it.meta.kind === 'audio' ? '/audio/downloads' : '/video/downloads')
  }
}
</script>
