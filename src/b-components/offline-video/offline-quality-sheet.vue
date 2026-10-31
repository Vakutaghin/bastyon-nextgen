<template>
  <Modal
    :open="!!choice"
    :width="380"
    :centered="true"
    :z-index="2700"
    :footer="null"
    :title="t('offlineVideo.qualityTitle')"
    @cancel="store.closeSheet()"
  >
    <SC_SheetBody v-if="choice" data-testid="offline-quality-sheet">
      <SC_QualityRow
        v-for="q in rows"
        :key="q.height"
        type="button"
        :disabled="starting || !q.fits"
        :data-testid="`offline-quality-${q.height}`"
        @click="pick(q)"
      >
        <span>{{ q.height }}p</span>
        <span class="size">{{ q.sizeText }}</span>
      </SC_QualityRow>
      <SC_SheetFooter>
        <span v-if="freeText">{{ t('offlineVideo.free', { size: freeText }) }}</span>
        <Checkbox v-model:checked="remember">{{ t('offlineVideo.remember') }}</Checkbox>
      </SC_SheetFooter>
    </SC_SheetBody>
  </Modal>
</template>

<script setup lang="ts">
// Лист выбора качества: «480p · 95 МБ», внизу свободное место и «Запомнить» —
// дальше качается сразу запомненное (ближайшее не выше).

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Checkbox, Modal } from 'ant-design-vue'
import { formatBytes } from '@/services/offline-video/format-bytes'
import type { OfflineQuality } from '@/services/offline-video/offline-job'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { OFFLINE_SPARE_BYTES, useOfflineDownload } from './use-offline-download'
import { SC_QualityRow, SC_SheetBody, SC_SheetFooter } from './offline-video.styled'

const { t, locale } = useI18n()
const store = useOfflineVideosStore()
const { begin } = useOfflineDownload()
const remember = ref(false)
const starting = ref(false)

const choice = computed(() => store.sheet)
watch(choice, () => {
  remember.value = false
})

const rows = computed(() => {
  const c = choice.value
  if (!c) return []
  return c.qualities.map((q) => ({
    ...q,
    sizeText: q.size ? formatBytes(q.size, locale.value) : '',
    fits: c.free === null || !q.size || c.free >= q.size + OFFLINE_SPARE_BYTES,
  }))
})

const freeText = computed(() => {
  const free = choice.value?.free
  return free === null || free === undefined ? '' : formatBytes(free, locale.value)
})

async function pick(quality: OfflineQuality): Promise<void> {
  const c = choice.value
  if (!c) return
  if (remember.value) store.setQualityPref(quality.height)
  starting.value = true
  try {
    if (await begin(c, quality)) store.closeSheet()
  } finally {
    starting.value = false
  }
}
</script>
