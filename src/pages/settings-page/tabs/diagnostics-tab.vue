<template>
  <SC_Diag>
    <SC_DiagTitle>{{ t('settings.diagnostics.title') }}</SC_DiagTitle>

    <SC_DiagGroup>
      <SC_DiagGroupTitle>{{ t('settings.diagnostics.appGroup') }}</SC_DiagGroupTitle>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.version') }}</SC_DiagLabel>
        <SC_DiagValue>{{ appVersion }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.build') }}</SC_DiagLabel>
        <SC_DiagValue>{{ buildMode }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.platform') }}</SC_DiagLabel>
        <SC_DiagValue>{{ platform }}</SC_DiagValue>
      </SC_DiagRow>
    </SC_DiagGroup>

    <SC_DiagGroup>
      <SC_DiagGroupTitle>{{ t('settings.diagnostics.connectionGroup') }}</SC_DiagGroupTitle>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.online') }}</SC_DiagLabel>
        <SC_DiagValue>{{
          isOnline ? t('settings.diagnostics.yes') : t('settings.diagnostics.no')
        }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.tor') }}</SC_DiagLabel>
        <SC_DiagValue>{{ torStatus }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow v-if="preferredNode">
        <SC_DiagLabel>{{ t('settings.diagnostics.preferredNode') }}</SC_DiagLabel>
        <SC_DiagValue>{{ preferredNode }}</SC_DiagValue>
      </SC_DiagRow>
    </SC_DiagGroup>

    <SC_DiagGroup>
      <SC_DiagGroupTitle>{{ t('settings.diagnostics.nodeGroup') }}</SC_DiagGroupTitle>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.nodeHost') }}</SC_DiagLabel>
        <SC_DiagValue>{{ nodeHost }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.nodeVersion') }}</SC_DiagLabel>
        <SC_DiagValue>{{ nodeVersion }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.blockHeight') }}</SC_DiagLabel>
        <SC_DiagValue>{{ blockHeight }}</SC_DiagValue>
      </SC_DiagRow>
      <SC_DiagRow>
        <SC_DiagLabel>{{ t('settings.diagnostics.blockTime') }}</SC_DiagLabel>
        <SC_DiagValue>{{ blockTime }}</SC_DiagValue>
      </SC_DiagRow>
    </SC_DiagGroup>
  </SC_Diag>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTorStore } from '@/stores/tor-store'
import { useNodeInfo } from '@/composables/use-block-explorer-queries'
import { getExplorerPreferredNode } from '@/composables/use-explorer-preferred-node'
import { isTauri, isCapacitor } from '@/b-components/video-uploader/utils/environment'
import {
  SC_Diag,
  SC_DiagTitle,
  SC_DiagGroup,
  SC_DiagGroupTitle,
  SC_DiagRow,
  SC_DiagLabel,
  SC_DiagValue,
} from './diagnostics-tab.styled'

declare const __APP_VERSION__: string

const { t, locale } = useI18n()
const torStore = useTorStore()
const { data: nodeInfo } = useNodeInfo()

const DASH = '—'

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const buildMode = import.meta.env?.MODE ?? 'unknown'
const platform = isTauri() ? 'Tauri (desktop)' : isCapacitor() ? 'Capacitor (mobile)' : 'Browser'

const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
function syncOnline(): void {
  if (typeof navigator !== 'undefined') isOnline.value = navigator.onLine
}

const torStatus = computed<string>(() =>
  torStore.enabled ? torStore.status : t('settings.diagnostics.off')
)

const preferredNode = computed<string>(() => {
  const n = getExplorerPreferredNode()
  return n ? `${n.host}:${n.port}` : ''
})

const nodeData = computed(() => {
  const resp = nodeInfo.value
  return resp && resp.result === 'success' ? resp.data : null
})
const nodeHost = computed<string>(() => nodeInfo.value?.node || DASH)
const nodeVersion = computed<string>(() => nodeData.value?.version || DASH)
const blockHeight = computed<string>(() => {
  const h = nodeData.value?.lastblock?.height
  return typeof h === 'number' ? h.toLocaleString(locale.value) : DASH
})
const blockTime = computed<string>(() => {
  const ts = nodeData.value?.lastblock?.time
  return typeof ts === 'number' && ts > 0 ? new Date(ts * 1000).toLocaleString(locale.value) : DASH
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', syncOnline)
    window.removeEventListener('offline', syncOnline)
  }
})
</script>
