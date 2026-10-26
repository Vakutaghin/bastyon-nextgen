<template>
  <!-- Модуль mesh-сетей (десктоп): радио и Reticulum, скачанные по просьбе
       пользователя. На странице «Mesh-сети» — только пока его нет или он
       устарел, в настройках — всегда. -->
  <SC_ModuleCard v-if="visible">
    <SC_ModuleHead>
      <SC_ModuleTitle>{{ t('mesh.module.title') }}</SC_ModuleTitle>
      <SC_ModuleStatus>{{ statusLabel }}</SC_ModuleStatus>
    </SC_ModuleHead>
    <SC_ModuleDesc>{{ t('mesh.module.description') }}</SC_ModuleDesc>
    <ModuleDiskUsage module="mesh" />

    <SC_ModuleActions v-if="store.installing">
      <span role="status">{{ t('mesh.module.downloading', { percent: store.percent }) }}</span>
      <Button size="small" @click="store.cancel()">{{ t('mesh.module.cancel') }}</Button>
    </SC_ModuleActions>
    <SC_ModuleActions v-else-if="store.supported && !store.installed">
      <Button :type="page ? 'primary' : 'default'" size="small" @click="store.install()">
        {{ t('mesh.module.download', { size: formatFileSize(store.size) }) }}
      </Button>
    </SC_ModuleActions>
    <SC_ModuleActions v-else-if="store.installed">
      <Button v-if="store.supported && !store.current" size="small" @click="store.install()">
        {{ t('mesh.module.update', { size: formatFileSize(store.size) }) }}
      </Button>
      <Button v-if="!page" size="small" danger @click="onRemove">
        {{ t('mesh.module.remove') }}
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
import { useMeshModuleStore } from '@/stores/mesh-module-store'
import ModuleDiskUsage from './module-disk-usage.vue'
import {
  SC_ModuleActions,
  SC_ModuleCard,
  SC_ModuleDesc,
  SC_ModuleError,
  SC_ModuleHead,
  SC_ModuleStatus,
  SC_ModuleTitle,
} from './compression-module-section.styled'

const props = defineProps<{
  /** На странице «Mesh-сети»: карточка — только пока модуль нужно скачать. */
  page?: boolean
}>()

const { t } = useI18n()
const store = useMeshModuleStore()

onMounted(() => {
  if (store.required) void store.refresh()
})

const visible = computed<boolean>(() => {
  if (!store.required || !store.loaded) return false
  if (!props.page) return true
  return store.installing || !store.installed || (store.supported && !store.current)
})

const statusLabel = computed<string>(() => {
  if (!store.installed) {
    return store.supported ? t('mesh.module.statusNone') : t('mesh.module.unsupported')
  }
  return store.current ? t('mesh.module.statusInstalled') : t('mesh.module.statusOutdated')
})

function onRemove(): void {
  Modal.confirm({
    title: t('mesh.module.removeTitle'),
    content: t('mesh.module.removeContent'),
    okText: t('mesh.module.remove'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: () => store.remove(),
  })
}
</script>
