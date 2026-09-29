<template>
  <SC_MeshWork>
    <SC_MeshPage>
      <SC_MeshHead>
        <SC_MeshTitle>{{ t('mesh.title') }}</SC_MeshTitle>
        <SC_MeshStatus v-if="availability.serial">
          <SC_MeshDot :state="status" />
          <span>{{ statusText }}</span>
        </SC_MeshStatus>
      </SC_MeshHead>

      <SC_MeshLead>{{ t('mesh.lead') }}</SC_MeshLead>

      <SC_MeshNote v-if="!availability.serial">{{ t('mesh.desktopOnly') }}</SC_MeshNote>

      <template v-else>
        <MeshDeviceCard v-if="status === 'connected'" />
        <MeshConnectPanel v-else />

        <template v-if="status === 'connected'">
          <MeshContacts />
          <MeshChannels />
        </template>
      </template>
    </SC_MeshPage>
  </SC_MeshWork>
</template>

<script setup lang="ts">
/**
 * Mesh-сети: переписка через LoRa-радио без интернета. Здесь радио
 * подключают и смотрят, кто рядом; сама переписка — в мессенджере, рядом
 * с обычными диалогами.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { radioAvailability } from '@/mesh/radio/open-link'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import MeshChannels from './mesh-channels.vue'
import MeshConnectPanel from './mesh-connect-panel.vue'
import MeshContacts from './mesh-contacts.vue'
import MeshDeviceCard from './mesh-device-card.vue'
import {
  SC_MeshDot,
  SC_MeshHead,
  SC_MeshLead,
  SC_MeshNote,
  SC_MeshPage,
  SC_MeshStatus,
  SC_MeshTitle,
  SC_MeshWork,
} from './mesh-page.styled'

const { t } = useI18n()
const connection = useMeshConnectionStore()
const { status, label } = storeToRefs(connection)
const availability = radioAvailability()

const statusText = computed<string>(() => {
  const text = t(`mesh.status.${status.value}`)
  return status.value === 'connected' && label.value ? `${text} · ${label.value}` : text
})

onMounted(() => {
  connection.refreshLastDevice()
})
</script>
