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
    <!-- Кэши приложения для компьютера. Предел держит само приложение (src-tauri
         storage): кэш больше него очищается при запуске и раз в полчаса. -->
    <template v-if="usage">
      <SC_CacheRow v-for="row in cacheRows" :key="row.kind" :data-testid="`cache-${row.kind}`">
        <SC_SystemLabel>
          <SC_SystemTitle>{{ row.title }}</SC_SystemTitle>
          <SC_SystemHint>{{ row.hint }}</SC_SystemHint>
          <SC_CacheUsage>
            {{
              t('settings.system.cacheUsage', {
                used: formatFileSize(row.used),
                limit: formatLimit(row.limit),
              })
            }}
          </SC_CacheUsage>
        </SC_SystemLabel>
        <SC_CacheControls>
          <SC_ScaleRow :aria-label="t('settings.system.cacheLimit')">
            <SC_ScaleButton
              v-for="limit in row.limits"
              :key="limit"
              :active="row.limit === limit"
              type="button"
              @click="storage.setLimit(row.kind, limit)"
            >
              {{ formatLimit(limit) }}
            </SC_ScaleButton>
          </SC_ScaleRow>
          <SC_DangerButton
            type="button"
            :disabled="storage.clearing !== null"
            @click="onClearKind(row.kind)"
          >
            {{
              storage.clearing === row.kind
                ? t('settings.system.clearing')
                : t('settings.system.clearButton')
            }}
          </SC_DangerButton>
        </SC_CacheControls>
      </SC_CacheRow>
    </template>

    <SC_SystemRow>
      <SC_SystemLabel>
        <SC_SystemTitle>{{ t('settings.system.storeDecrypted') }}</SC_SystemTitle>
        <SC_SystemHint>{{ t('settings.system.storeDecryptedHint') }}</SC_SystemHint>
      </SC_SystemLabel>
      <Switch
        :checked="prefs.storeDecryptedMessages"
        data-testid="store-decrypted"
        @change="onStoreDecrypted"
      />
    </SC_SystemRow>

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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal, Switch, message } from 'ant-design-vue'

import { cacheAPI } from '@/db/apis/cache-api'
import { clearAllDecrypted } from '@/db/apis/decrypted-messages-api'
import { isTauri } from '@/b-components/video-uploader/utils/environment'
import { formatFileSize } from '@/b-components/messenger/components/file-message/helpers'
import { isAutostartEnabled, setAutostart } from '@/composables/use-autostart'
import { UI_SCALES, useAppPreferencesStore } from '@/stores/app-preferences-store'
import {
  IPFS_CACHE_LIMITS,
  WEB_CACHE_LIMITS,
  formatLimit,
  useStorageStore,
  type CacheKind,
} from '@/stores/storage-store'
import { SC_SettingsSectionTitle } from '../settings-page-main.styled'
import {
  SC_CacheControls,
  SC_CacheRow,
  SC_CacheUsage,
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

const storage = useStorageStore()
const usage = computed(() => storage.usage)

interface CacheRowView {
  kind: CacheKind
  title: string
  hint: string
  used: number
  limit: number
  limits: readonly number[]
}

/** Веб-кэш есть всегда, кэш IPFS — когда модуль установлен. */
const cacheRows = computed<CacheRowView[]>(() => {
  const u = usage.value
  if (!u) return []
  const rows: CacheRowView[] = [
    {
      kind: 'web',
      title: t('settings.system.webCache'),
      hint: t('settings.system.webCacheHint'),
      used: u.webCache,
      limit: u.limits.web,
      limits: WEB_CACHE_LIMITS,
    },
  ]
  if (u.ipfsCache !== null) {
    rows.push({
      kind: 'ipfs',
      title: t('settings.system.ipfsCache'),
      hint: t('settings.system.ipfsCacheHint'),
      used: u.ipfsCache,
      limit: u.limits.ipfs,
      limits: IPFS_CACHE_LIMITS,
    })
  }
  return rows
})

async function onClearKind(kind: CacheKind): Promise<void> {
  if (await storage.clear(kind)) message.success(t('settings.system.cacheCleared'))
  else message.error(t('settings.system.cacheClearFailed'))
}

/** Выключили — стираем уже сохранённое: настройка про то, что лежит на диске. */
async function onStoreDecrypted(checked: SwitchValue): Promise<void> {
  const store = Boolean(checked)
  await prefs.set('storeDecryptedMessages', store)
  if (!store) {
    await clearAllDecrypted()
    message.success(t('settings.system.storeDecryptedErased'))
  }
}

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
  void storage.refresh()
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
