<template>
  <SC_List data-testid="offline-downloads">
    <SC_ListHead v-if="list.length">
      <span
        >{{ t('offlineVideo.used', { size: usedText }) }} <HelpLink topic="offline-video#where"
      /></span>
      <Button size="small" danger data-testid="offline-remove-all" @click="confirmRemoveAll">
        {{ t('offlineVideo.removeAll') }}
      </Button>
    </SC_ListHead>
    <OfflineDownloadCard v-for="item in list" :key="item.id" :item="item" />
    <SC_Empty v-if="store.ready && !list.length">
      {{ store.available ? t(emptyKey) : t('offlineVideo.notHere') }}
    </SC_Empty>
  </SC_List>
</template>

<script setup lang="ts">
// Вкладка «Скачанное» в «Видео» и «Аудио»: своё, свежее сверху, занятое место
// и «Удалить всё». Работает и без сети — всё из папки скачанного.

import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'
import { formatBytes } from '@/services/offline-video/format-bytes'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import OfflineDownloadCard from './offline-download-card.vue'
import { SC_Empty, SC_List, SC_ListHead } from './offline-video.styled'
import HelpLink from '@/b-components/help/help-link.vue'

const props = defineProps<{ kind: 'video' | 'audio' }>()

const { t, locale } = useI18n()
const store = useOfflineVideosStore()

onMounted(() => void store.hydrate())

const list = computed(() => store.mine.filter((i) => i.meta.kind === props.kind))
const usedText = computed(() =>
  formatBytes(
    list.value.reduce(
      (sum, i) => sum + (i.state.status === 'done' ? i.state.total : i.state.received),
      0
    ),
    locale.value
  )
)
const emptyKey = computed(() =>
  props.kind === 'audio' ? 'offlineVideo.emptyAudio' : 'offlineVideo.emptyVideo'
)

function confirmRemoveAll(): void {
  Modal.confirm({
    title: t('offlineVideo.removeAllTitle'),
    content: t('offlineVideo.removeAllText'),
    okText: t('offlineVideo.removeAll'),
    okButtonProps: { danger: true },
    cancelText: t('offlineVideo.cancelAction'),
    zIndex: 2700,
    onOk: async () => {
      for (const item of list.value) await store.remove(item.id).catch(() => {})
    },
  })
}
</script>
