<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.modules') }}</SC_SettingsSectionTitle>
  <SC_ModulesIntro>
    {{ t('settings.modules.intro') }}
    <template v-if="storage.usage">
      {{ t('settings.modules.total', { size: formatFileSize(storage.modulesTotal) }) }}
    </template>
    {{ t('settings.modules.updates') }}
  </SC_ModulesIntro>

  <IpfsSection />
  <TorModuleSection />
  <VoiceInputSection />
  <CompressionModuleSection />
  <MeshModuleSection />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { useCompressionModuleStore } from '@/stores/compression-module-store'
import { useIpfsStore } from '@/stores/ipfs-store'
import { useMeshModuleStore } from '@/stores/mesh-module-store'
import { useStorageStore } from '@/stores/storage-store'
import { useTorStore } from '@/stores/tor-store'
import { useVoiceInputStore } from '@/stores/voice-input-store'
import { SC_SettingsSectionTitle } from '../settings-page-main.styled'
import { SC_ModulesIntro } from './compression-module-section.styled'
import CompressionModuleSection from './compression-module-section.vue'
import IpfsSection from './ipfs-section.vue'
import MeshModuleSection from './mesh-module-section.vue'
import TorModuleSection from './tor-module-section.vue'
import VoiceInputSection from './voice-input-section.vue'

const { t } = useI18n()
const storage = useStorageStore()
const ipfs = useIpfsStore()
const tor = useTorStore()
const voice = useVoiceInputStore()
const compression = useCompressionModuleStore()
const mesh = useMeshModuleStore()

onMounted(() => {
  void storage.refresh()
})

// Модуль скачали или удалили — размеры на диске уже другие.
watch(
  () => [
    ipfs.installed,
    tor.installed,
    voice.installedModels.length,
    compression.installed,
    mesh.installed,
  ],
  () => void storage.refresh()
)
</script>
