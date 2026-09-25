<template>
  <SC_SettingsSectionTitle>{{ t('settings.tabs.system') }}</SC_SettingsSectionTitle>

  <SC_SystemSection>
    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.system.animations') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.system.animationsHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.animations" @change="onAnimations" />
    </SC_SystemRow>

    <!-- Масштабом в браузере заведует сам браузер — настройку показываем только в десктопе. -->
    <SC_SystemRow v-if="isDesktop">
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.system.uiScale') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.system.uiScaleHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <SC_ScaleRow>
        <SC_ScaleButton
          v-for="scale in UI_SCALES"
          :key="scale"
          :active="prefs.uiScale === scale"
          type="button"
          @click="onScale(scale)"
        >
          {{ scale }}%
        </SC_ScaleButton>
      </SC_ScaleRow>
    </SC_SystemRow>

    <SC_SystemRow v-if="isDesktop">
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.system.autostart') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.system.autostartHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch :checked="prefs.autostart" :loading="autostartBusy" @change="onAutostart" />
    </SC_SystemRow>
  </SC_SystemSection>

  <SC_SettingsSectionTitle>{{ t('settings.system.storageTitle') }}</SC_SettingsSectionTitle>
  <SC_SystemSection>
    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.system.clearCache') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.system.clearCacheHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <SC_DangerButton type="button" :disabled="clearing" @click="onClearCache">
        {{ clearing ? t('settings.system.clearing') : t('settings.system.clearButton') }}
      </SC_DangerButton>
    </SC_SystemRow>
  </SC_SystemSection>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Switch, message } from 'ant-design-vue'

import { cacheAPI } from '@/db/apis/cache-api'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { isAutostartEnabled, setAutostart } from '@/composables/use-autostart'
import { UI_SCALES, useAppPreferencesStore } from '@/stores/app-preferences-store'
import { SC_SettingsSectionTitle } from '../settings-page-main.styled'
import {
  SC_DangerButton,
  SC_ScaleButton,
  SC_ScaleRow,
  SC_SystemHint,
  SC_SystemLabel,
  SC_SystemRow,
  SC_SystemSection,
  SC_SystemTitle,
} from './system-tab.styled'

/** Тип значения, который отдаёт ant-свитч. */
type SwitchValue = string | number | boolean

const { t } = useI18n()
const prefs = useAppPreferencesStore()
const isDesktop = isTauri()

const clearing = ref(false)
const autostartBusy = ref(false)

// Ant-свитч отдаёт string | number | boolean — приводим на границе.
function onAnimations(checked: SwitchValue): void {
  void prefs.set('animations', Boolean(checked))
}

async function onScale(scale: number): Promise<void> {
  await prefs.set('uiScale', scale)
}

/**
 * Автозапуск живёт в системе, а не у нас: сначала просим ОС, и только если она
 * согласилась — запоминаем. Иначе тумблер врал бы о состоянии системы.
 */
function onAutostart(checked: SwitchValue): void {
  void applyAutostart(Boolean(checked))
}

// Автозапуск могли выключить в настройках системы, минуя приложение: при
// открытии вкладки сверяем тумблер с тем, что на самом деле записано в ОС.
onMounted(async () => {
  if (!isDesktop) return
  const actual = await isAutostartEnabled()
  if (actual !== prefs.autostart) await prefs.set('autostart', actual)
})

async function applyAutostart(checked: boolean): Promise<void> {
  autostartBusy.value = true
  try {
    const applied = await setAutostart(checked)
    if (!applied) {
      message.error(t('settings.system.autostartFailed'))
      return
    }
    await prefs.set('autostart', checked)
  } finally {
    autostartBusy.value = false
  }
}

function onClearCache(): void {
  Modal.confirm({
    title: t('settings.system.clearConfirmTitle'),
    content: t('settings.system.clearConfirmText'),
    okText: t('settings.system.clearButton'),
    okType: 'danger',
    cancelText: t('settings.system.cancel'),
    centered: true,
    onOk: async () => {
      clearing.value = true
      try {
        const { removed } = await cacheAPI.clear()
        message.success(t('settings.system.cleared', { count: removed }))
      } finally {
        clearing.value = false
      }
    },
  })
}
</script>
