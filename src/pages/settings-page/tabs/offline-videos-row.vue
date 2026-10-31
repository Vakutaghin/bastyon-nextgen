<template>
  <SC_CacheRow v-if="store.available" data-testid="offline-videos-settings">
    <SC_SystemLabel>
      <SC_SystemTitle>{{ t('offlineVideo.settingsTitle') }}</SC_SystemTitle>
      <SC_SystemHint>{{ t('offlineVideo.settingsHint') }}</SC_SystemHint>
      <SC_CacheUsage>{{ usageText }}</SC_CacheUsage>
    </SC_SystemLabel>
    <SC_CacheControls>
      <SC_ScaleRow :aria-label="t('offlineVideo.defaultQuality')">
        <SC_ScaleButton
          v-for="choice in OFFLINE_QUALITY_CHOICES"
          :key="String(choice)"
          :active="store.qualityPref === choice"
          type="button"
          @click="store.setQualityPref(choice)"
        >
          {{ choice === 'ask' ? t('offlineVideo.ask') : `${choice}p` }}
        </SC_ScaleButton>
      </SC_ScaleRow>
      <SC_SwitchLine v-if="isAndroid">
        <Switch
          :checked="store.wifiOnly"
          data-testid="offline-wifi-only"
          @change="(v: SwitchValue) => store.setWifiOnly(Boolean(v))"
        />
        <span>{{ t('offlineVideo.wifiOnly') }}</span>
      </SC_SwitchLine>
      <SC_DangerButton type="button" :disabled="!hasAny || clearing" @click="onClear">
        {{ clearing ? t('settings.system.clearing') : t('offlineVideo.removeAll') }}
      </SC_DangerButton>
    </SC_CacheControls>
  </SC_CacheRow>
</template>

<script setup lang="ts">
// «Скачанные видео» в «Локальных данных»: сколько занято, качество по
// умолчанию, «Только по Wi-Fi» (Android) и «Удалить всё» — всё скачанное на
// устройстве, у всех аккаунтов.

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Capacitor } from '@capacitor/core'
import { Modal, Switch } from 'ant-design-vue'
import { formatBytes } from '@/services/offline-video/format-bytes'
import { OFFLINE_QUALITY_CHOICES, useOfflineVideosStore } from '@/stores/offline-videos-store'
import {
  SC_CacheControls,
  SC_CacheRow,
  SC_CacheUsage,
  SC_DangerButton,
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SwitchLine,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemTitle,
} from './system-tab.styled'

type SwitchValue = string | number | boolean

const { t, locale } = useI18n()
const store = useOfflineVideosStore()
const isAndroid = Capacitor.getPlatform() === 'android'
const clearing = ref(false)

onMounted(async () => {
  await store.hydrate()
  await store.refreshUsage()
})

const hasAny = computed(() => store.items.size > 0)
const usageText = computed(() => {
  const used = store.usage?.used ?? 0
  const free = store.usage?.free
  const usedText = formatBytes(used, locale.value)
  return free === null || free === undefined
    ? t('offlineVideo.used', { size: usedText })
    : t('offlineVideo.usedAndFree', { size: usedText, free: formatBytes(free, locale.value) })
})

function onClear(): void {
  Modal.confirm({
    title: t('offlineVideo.removeAllTitle'),
    content: t('offlineVideo.removeAllDeviceText'),
    okText: t('offlineVideo.removeAll'),
    okType: 'danger',
    cancelText: t('settings.system.cancel'),
    centered: true,
    onOk: async () => {
      clearing.value = true
      try {
        await store.clearAll()
        await store.refreshUsage()
      } finally {
        clearing.value = false
      }
    },
  })
}
</script>
