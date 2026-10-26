<template>
  <SC_ModuleDisk v-if="bytes > 0" data-testid="module-disk">
    {{ t('settings.modules.onDisk', { size: formatFileSize(bytes) }) }}
  </SC_ModuleDisk>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { useStorageStore, type ModulesUsage } from '@/stores/storage-store'
import { SC_ModuleDisk } from './compression-module-section.styled'

// Размеры меряет вкладка «Модули» (storage.refresh): вне её строки нет.
const props = defineProps<{ module: keyof ModulesUsage }>()

const { t } = useI18n()
const storage = useStorageStore()

const bytes = computed<number>(() => storage.usage?.modules[props.module] ?? 0)
</script>
