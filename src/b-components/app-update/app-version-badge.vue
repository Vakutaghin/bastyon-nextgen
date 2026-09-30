<template>
  <SC_VersionBadge :class="{ compact }">
    <SC_VersionText v-if="!compact" :class="tone" aria-live="polite">
      {{ status || version }}
    </SC_VersionText>
    <SC_UpdateButton
      type="button"
      :class="tone"
      :title="buttonTitle"
      :aria-label="buttonTitle"
      :disabled="checking"
      @click="onCheck"
    >
      <CheckOutlined v-if="flash === 'upToDate'" />
      <ExclamationCircleOutlined v-else-if="flash === 'failed'" />
      <DownloadOutlined v-else-if="hasUpdate && !checking" />
      <SyncOutlined v-else :spin="checking" />
    </SC_UpdateButton>
  </SC_VersionBadge>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppUpdate } from '@/composables/use-app-update'
import {
  CheckOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@/components/icons'
import { SC_VersionBadge, SC_VersionText, SC_UpdateButton } from './app-version-badge.styled'

// Номер версии и кнопка «проверить обновления». Найденную версию предлагает
// окно обновления (update-modal), а «последняя версия» и «не удалось» на пару
// секунд встают на место номера.

/** Сколько держится ответ проверки, прежде чем вернётся номер версии. */
const FLASH_MS = 4000

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { t } = useI18n()
const { available, hasUpdate, checking, failed, currentVersion, check } = useAppUpdate()

const version = `v${currentVersion}`

const flash = ref<'upToDate' | 'failed' | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

function clearFlash(): void {
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = null
  flash.value = null
}

function showFlash(kind: 'upToDate' | 'failed'): void {
  clearFlash()
  flash.value = kind
  flashTimer = setTimeout(clearFlash, FLASH_MS)
}

/** Что сказать вместо номера версии; пусто — показывать номер. */
const status = computed<string>(() => {
  if (checking.value) return t('update.checking')
  if (flash.value === 'upToDate') return t('update.upToDate')
  if (flash.value === 'failed') return t('update.failed')
  if (hasUpdate.value && available.value) {
    return t('update.newVersion', { version: available.value.tag })
  }
  return ''
})

const tone = computed<string>(() => {
  if (checking.value) return ''
  if (flash.value === 'upToDate') return 'success'
  if (flash.value === 'failed') return 'warning'
  return hasUpdate.value ? 'accent' : ''
})

// В свёрнутой панели подписи нет — номер версии уходит в подсказку кнопки.
const buttonTitle = computed<string>(() => {
  const action = status.value || t('update.checkUpdates')
  return props.compact ? `${version} · ${action}` : action
})

async function onCheck(): Promise<void> {
  clearFlash()
  const release = await check({ offerSkipped: true })
  if (release) return
  showFlash(failed.value ? 'failed' : 'upToDate')
}

onBeforeUnmount(clearFlash)
</script>
