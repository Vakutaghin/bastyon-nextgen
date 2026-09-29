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
        <SC_MeshNetworks role="tablist" :aria-label="t('mesh.networks.label')">
          <SC_MeshNetwork
            v-for="n in networks"
            :key="n.id"
            type="button"
            role="tab"
            :active="network === n.id"
            :aria-selected="network === n.id"
            @click="select(n.id)"
          >
            <SC_MeshDot :state="n.status" />
            {{ n.label }}
          </SC_MeshNetwork>
        </SC_MeshNetworks>

        <template v-if="network === 'meshtastic'">
          <SC_MeshNote>{{ t('mesh.networks.meshtasticLead') }}</SC_MeshNote>
          <MtDeviceCard v-if="mt.status === 'connected'" />
          <MeshConnectPanel v-else key="meshtastic" network="meshtastic" />
          <template v-if="mt.status === 'connected'">
            <MtNodes />
            <MtChannels />
          </template>
        </template>

        <template v-else-if="network === 'reticulum'">
          <SC_MeshNote>{{ t('mesh.networks.reticulumLead') }}</SC_MeshNote>
          <RnsNodeCard />
          <template v-if="rns.status === 'running'">
            <RnsPeers />
            <RnsPropagation />
          </template>
          <RnsInterfaces />
        </template>

        <template v-else>
          <SC_MeshNote>{{ t('mesh.networks.meshcoreLead') }}</SC_MeshNote>
          <MeshDeviceCard v-if="mc.status === 'connected'" />
          <MeshConnectPanel v-else key="meshcore" network="meshcore" />
          <template v-if="mc.status === 'connected'">
            <MeshContacts />
            <MeshChannels />
          </template>
        </template>
      </template>
    </SC_MeshPage>
  </SC_MeshWork>
</template>

<script setup lang="ts">
/**
 * Mesh-сети: переписка через LoRa-радио без интернета. Здесь радио
 * подключают и смотрят, кто рядом; сама переписка — в мессенджере, рядом
 * с обычными диалогами. Радио двух сетей (Meshtastic и MeshCore) можно
 * держать подключёнными одновременно — у каждой своя вкладка.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { radioAvailability } from '@/mesh/radio/open-link'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import RnsInterfaces from './rns-interfaces.vue'
import RnsNodeCard from './rns-node-card.vue'
import RnsPeers from './rns-peers.vue'
import RnsPropagation from './rns-propagation.vue'
import MeshChannels from './mesh-channels.vue'
import MeshConnectPanel from './mesh-connect-panel.vue'
import MeshContacts from './mesh-contacts.vue'
import MeshDeviceCard from './mesh-device-card.vue'
import MtChannels from './mt-channels.vue'
import MtDeviceCard from './mt-device-card.vue'
import MtNodes from './mt-nodes.vue'
import {
  SC_MeshDot,
  SC_MeshHead,
  SC_MeshLead,
  SC_MeshNetwork,
  SC_MeshNetworks,
  SC_MeshNote,
  SC_MeshPage,
  SC_MeshStatus,
  SC_MeshTitle,
  SC_MeshWork,
} from './mesh-page.styled'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const mt = useMeshtasticConnectionStore()
const mc = useMeshConnectionStore()
const rns = useReticulumStore()

/** Вкладки: радио-сети и Reticulum (он — только там, где есть свой узел). */
type Tab = 'meshtastic' | 'meshcore' | 'reticulum'
const availability = radioAvailability()

/** Вкладка — из адреса (`?net=meshcore`); без неё — та сеть, где радио уже на связи. */
const network = computed<Tab>(() => {
  const q = route.query.net
  if (q === 'meshcore' || q === 'meshtastic') return q
  if (q === 'reticulum' && rns.available) return q
  return mc.status !== 'idle' && mt.status === 'idle' ? 'meshcore' : 'meshtastic'
})

function select(next: Tab): void {
  if (next !== network.value) void router.replace({ query: { ...route.query, net: next } })
}

const networks = computed(() => [
  { id: 'meshtastic' as const, label: t('mesh.networks.meshtastic'), status: mt.status },
  { id: 'meshcore' as const, label: t('mesh.networks.meshcore'), status: mc.status },
  ...(rns.available
    ? [
        {
          id: 'reticulum' as const,
          label: t('mesh.networks.reticulum'),
          status:
            rns.status === 'running' ? 'connected' : rns.status === 'idle' ? 'idle' : 'connecting',
        },
      ]
    : []),
])

const status = computed(() => {
  if (network.value === 'reticulum') {
    return rns.status === 'running' ? 'connected' : rns.status === 'idle' ? 'idle' : 'connecting'
  }
  return network.value === 'meshtastic' ? mt.status : mc.status
})

const statusText = computed<string>(() => {
  if (network.value === 'reticulum') return t(`mesh.rns.status.${rns.status}`)
  const store = network.value === 'meshtastic' ? mt : mc
  if (network.value === 'meshtastic' && mt.rebooting && mt.status !== 'connected') {
    return t('mesh.mt.device.rebooting')
  }
  const text = t(`mesh.status.${store.status}`)
  return store.status === 'connected' && store.label ? `${text} · ${store.label}` : text
})

onMounted(() => {
  mt.refreshLastDevice()
  mc.refreshLastDevice()
  rns.ensureConfig()
})
</script>
