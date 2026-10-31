<template>
  <SC_PostActionBtn
    v-if="!item"
    type="button"
    :disabled="busy"
    :aria-label="t('offlineVideo.download')"
    data-testid="offline-download"
    @click="download(source)"
  >
    <LoadingOutlined v-if="busy" spin />
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
import { Dropdown, Menu } from 'ant-design-vue'
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayIcon,
  ReloadOutlined,
} from '@/components/icons'
import { SC_PostActionBtn } from '@/b-components/content/post-card/styled'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import OfflineRing from './offline-ring.vue'
import { offlineFraction, offlinePercent, offlineStatusText } from './offline-status'
import {
  offlineSourceFromPost,
  useOfflineDownload,
  type OfflinePostLike,
} from './use-offline-download'

const props = defineProps<{ post: OfflinePostLike }>()

const { t, locale } = useI18n()
const router = useRouter()
const store = useOfflineVideosStore()
const { busy, download } = useOfflineDownload()
const menuOpen = ref(false)

const source = computed(() => offlineSourceFromPost(props.post))
const item = computed(() => store.mineFor(props.post.videoUrl))
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

const menuItems = computed(() => {
  const it = item.value
  if (!it) return []
  const out: { key: string; label: string; icon: () => ReturnType<typeof h>; danger?: boolean }[] =
    []
  if (it.state.status === 'downloading' || it.state.status === 'queued') {
    out.push({ key: 'pause', label: t('offlineVideo.pause'), icon: icon(PauseCircleOutlined) })
  } else if (it.state.status === 'paused') {
    out.push({ key: 'resume', label: t('offlineVideo.resume'), icon: icon(PlayIcon) })
  } else if (it.state.status === 'failed') {
    out.push({ key: 'resume', label: t('offlineVideo.retry'), icon: icon(ReloadOutlined) })
  }
  out.push({
    key: 'downloads',
    label: t('offlineVideo.openDownloads'),
    icon: icon(DownloadOutlined),
  })
  out.push({
    key: 'remove',
    label: it.state.status === 'done' ? t('offlineVideo.remove') : t('offlineVideo.cancel'),
    icon: icon(DeleteOutlined),
    danger: true,
  })
  return out
})

function onMenu({ key }: { key: string | number }): void {
  menuOpen.value = false
  const it = item.value
  if (!it) return
  if (key === 'pause') void store.pause(it.id)
  else if (key === 'resume') void store.resume(it.id)
  else if (key === 'remove') void store.remove(it.id)
  else if (key === 'downloads') {
    void router.push(it.meta.kind === 'audio' ? '/audio/downloads' : '/video/downloads')
  }
}
</script>
