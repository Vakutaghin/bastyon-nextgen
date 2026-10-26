<template>
  <!-- Модуль сжатия видео (десктоп): FFmpeg, скачанный по просьбе пользователя. -->
  <SC_ModuleCard v-if="desktop && store.available !== null">
    <SC_ModuleHead>
      <SC_ModuleTitle>{{ t('videoStudio.module.title') }}</SC_ModuleTitle>
      <SC_ModuleStatus>{{ statusLabel }}</SC_ModuleStatus>
    </SC_ModuleHead>
    <SC_ModuleDesc>{{ t('videoStudio.module.description') }}</SC_ModuleDesc>
    <ModuleInfo module="compression" />

    <SC_ModuleActions v-if="store.installing">
      <span role="status">{{
        t('videoStudio.module.downloadingShort', { percent: store.percent })
      }}</span>
      <Button size="small" @click="store.cancel()">{{ t('videoStudio.module.cancel') }}</Button>
    </SC_ModuleActions>
    <SC_ModuleActions v-else-if="store.installed">
      <Button size="small" danger @click="onRemove">{{ t('videoStudio.module.remove') }}</Button>
    </SC_ModuleActions>
    <SC_ModuleActions v-else-if="store.supported && !store.available">
      <Button size="small" @click="store.install()">
        {{ t('videoStudio.module.downloadSized', { size: formatFileSize(store.size) }) }}
      </Button>
    </SC_ModuleActions>
    <SC_ModuleError v-if="store.error" role="alert">{{ store.error }}</SC_ModuleError>
  </SC_ModuleCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'

import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { useCompressionModuleStore } from '@/stores/compression-module-store'
import ModuleInfo from './module-info.vue'
import {
  SC_ModuleActions,
  SC_ModuleCard,
  SC_ModuleDesc,
  SC_ModuleError,
  SC_ModuleHead,
  SC_ModuleStatus,
  SC_ModuleTitle,
} from './compression-module-section.styled'

const { t } = useI18n()
const store = useCompressionModuleStore()
const desktop = isTauri()

onMounted(() => {
  if (desktop) void store.refresh()
})

const statusLabel = computed<string>(() => {
  if (store.installed) return t('videoStudio.module.statusInstalled')
  if (store.available) return t('videoStudio.module.statusSystem')
  if (!store.supported) return t('videoStudio.module.unsupported')
  return t('videoStudio.module.statusNone')
})

function onRemove(): void {
  Modal.confirm({
    title: t('videoStudio.module.removeTitle'),
    content: t('videoStudio.module.removeContent'),
    okText: t('videoStudio.module.remove'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => store.remove(),
  })
}
</script>
