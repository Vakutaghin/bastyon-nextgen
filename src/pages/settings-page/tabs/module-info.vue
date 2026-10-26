<template>
  <SC_ModuleDisk v-if="parts.length" data-testid="module-info">{{
    parts.join(' · ')
  }}</SC_ModuleDisk>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { useStorageStore, type ModulesUsage, type ModuleVersions } from '@/stores/storage-store'
import { SC_ModuleDisk } from './compression-module-section.styled'

// Размеры и версии меряет вкладка «Модули» (storage.refresh): вне её строки нет.
const props = defineProps<{ module: keyof ModulesUsage }>()

const { t } = useI18n()
const storage = useStorageStore()

const parts = computed<string[]>(() => {
  const usage = storage.usage
  if (!usage) return []
  const out: string[] = []
  const bytes = usage.modules[props.module]
  if (bytes > 0) out.push(t('settings.modules.onDisk', { size: formatFileSize(bytes) }))
  const version =
    props.module in usage.versions ? usage.versions[props.module as keyof ModuleVersions] : null
  if (version?.installed) {
    out.push(
      version.pending
        ? t('settings.modules.versionPending', {
            version: version.installed,
            latest: version.latest,
          })
        : t('settings.modules.version', { version: version.installed })
    )
  }
  return out
})
</script>
