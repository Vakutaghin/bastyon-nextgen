<template>
  <SC_CacheRow v-if="store.canChooseLocation && location" data-testid="offline-location-settings">
    <SC_SystemLabel>
      <SC_SystemTitle>{{ t('offlineVideo.locationTitle') }}</SC_SystemTitle>
      <SC_SystemHint>{{
        isAndroid ? t('offlineVideo.locationHintAndroid') : t('offlineVideo.locationHint')
      }}</SC_SystemHint>
      <SC_LocationPath v-if="location.path" :title="location.path">{{
        location.path
      }}</SC_LocationPath>
      <SC_LocationWarn v-if="unavailableText" role="alert">{{ unavailableText }}</SC_LocationWarn>
      <SC_CacheUsage v-if="store.moving" role="status">{{ movingText }}</SC_CacheUsage>
    </SC_SystemLabel>
    <SC_CacheControls>
      <SC_ScaleRow v-if="isAndroid" :aria-label="t('offlineVideo.locationTitle')">
        <SC_ScaleButton
          :active="location.current !== 'sd'"
          :disabled="!!store.moving"
          type="button"
          data-testid="offline-location-internal"
          @click="move('internal')"
        >
          {{ t('offlineVideo.phoneMemory') }}
        </SC_ScaleButton>
        <SC_ScaleButton
          v-if="location.sd || location.current === 'sd'"
          :active="location.current === 'sd'"
          :disabled="!!store.moving"
          type="button"
          data-testid="offline-location-sd"
          @click="move('sd')"
        >
          {{ t('offlineVideo.sdCard') }}
        </SC_ScaleButton>
      </SC_ScaleRow>
      <template v-else>
        <SC_ActionButton
          type="button"
          :disabled="!!store.moving"
          data-testid="offline-location-choose"
          @click="chooseFolder"
        >
          {{ t('offlineVideo.chooseFolder') }}
        </SC_ActionButton>
        <SC_ActionButton
          v-if="!location.isDefault || location.unavailable"
          type="button"
          :disabled="!!store.moving"
          data-testid="offline-location-default"
          @click="move(null)"
        >
          {{ t('offlineVideo.defaultFolder') }}
        </SC_ActionButton>
      </template>
    </SC_CacheControls>
  </SC_CacheRow>
</template>

<script setup lang="ts">
// «Где хранить» скачанное: на компьютере — своя папка (другой диск), на
// Android — память телефона или карта памяти. Скачанное переносится, загрузки
// продолжаются на новом месте; диск или карта не подключены — предупреждение.

import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Capacitor } from '@capacitor/core'
import { appToast } from '@/b-components/app-toast'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import {
  SC_ActionButton,
  SC_CacheControls,
  SC_CacheRow,
  SC_CacheUsage,
  SC_LocationPath,
  SC_LocationWarn,
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemTitle,
} from './system-tab.styled'

const { t } = useI18n()
const store = useOfflineVideosStore()
const isAndroid = Capacitor.getPlatform() === 'android'
const location = computed(() => store.location)

onMounted(async () => {
  await store.hydrate()
  await store.refreshLocation()
})

const unavailableText = computed(() => {
  const missing = location.value?.unavailable
  if (!missing) return ''
  return typeof missing === 'string'
    ? t('offlineVideo.folderUnavailable', { path: missing })
    : t('offlineVideo.sdUnavailable')
})

const movingText = computed(() => {
  const p = store.moving
  if (!p?.total) return t('offlineVideo.movingStart')
  return t('offlineVideo.movingProgress', { done: p.done, total: p.total })
})

/** Код ошибки переноса → ключ перевода. */
const ERRORS: Record<string, string> = {
  no_space: 'noSpace',
  not_writable: 'notWritable',
  inside_current: 'insideCurrent',
  target_busy: 'targetBusy',
  busy: 'busy',
  no_sd: 'noSd',
}

async function move(target: string | null): Promise<void> {
  if (store.moving) return
  if (
    isAndroid &&
    target === (location.value?.current ?? 'internal') &&
    !location.value?.unavailable
  )
    return
  try {
    await store.moveTo(target)
    appToast.success({ message: t('offlineVideo.moved') })
  } catch (e) {
    const code = e instanceof Error ? e.message : ''
    if (code === 'moving') return
    appToast.error({ message: t(`offlineVideo.moveError.${ERRORS[code] ?? 'failed'}`) })
  }
}

async function chooseFolder(): Promise<void> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    directory: true,
    multiple: false,
    title: t('offlineVideo.chooseFolder'),
  })
  if (typeof picked === 'string' && picked) await move(picked)
}
</script>
