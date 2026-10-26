<template>
  <!-- Tor (десктоп): скачивается сам при первом включении кнопкой в шапке,
       здесь — состояние и удаление. -->
  <SC_ModuleCard v-if="tor.available && tor.installed !== null" data-testid="tor-module">
    <SC_ModuleHead>
      <SC_ModuleTitle>{{ t('settings.modules.tor.title') }}</SC_ModuleTitle>
      <SC_ModuleStatus>{{ statusLabel }}</SC_ModuleStatus>
    </SC_ModuleHead>
    <SC_ModuleDesc>{{ t('settings.modules.tor.description') }}</SC_ModuleDesc>
    <ModuleInfo module="tor" />

    <SC_ModuleActions v-if="!tor.installed">
      {{ t('settings.modules.tor.downloadsOnEnable') }}
    </SC_ModuleActions>
    <SC_ModuleActions v-else>
      <Button size="small" danger :disabled="tor.enabled" @click="onRemove">
        {{ t('settings.modules.tor.remove') }}
      </Button>
      <span v-if="tor.enabled">{{ t('settings.modules.tor.turnOffFirst') }}</span>
    </SC_ModuleActions>
    <SC_ModuleError v-if="error" role="alert">{{ error }}</SC_ModuleError>
  </SC_ModuleCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Modal } from 'ant-design-vue'

import { useStorageStore } from '@/stores/storage-store'
import { useTorStore } from '@/stores/tor-store'
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
const tor = useTorStore()
const storage = useStorageStore()
const error = ref('')

onMounted(() => {
  void tor.refreshInstalled()
})

const statusLabel = computed<string>(() => {
  if (!tor.installed) return t('settings.modules.tor.notInstalled')
  return tor.isReady ? t('settings.modules.tor.connected') : t('settings.modules.tor.installed')
})

function onRemove(): void {
  Modal.confirm({
    title: t('settings.modules.tor.removeConfirmTitle'),
    content: t('settings.modules.tor.removeConfirmText'),
    okText: t('settings.modules.tor.remove'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      error.value = ''
      if (!(await tor.uninstall())) error.value = t('settings.modules.tor.removeFailed')
      await storage.refresh()
    },
  })
}
</script>
