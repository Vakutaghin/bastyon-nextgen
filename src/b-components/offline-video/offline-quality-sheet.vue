<template>
  <Modal
    :open="!!choice || !!batch"
    :width="380"
    :centered="true"
    :z-index="2700"
    :footer="null"
    :title="title"
    @cancel="close"
  >
    <SC_SheetBody v-if="choice || batch" data-testid="offline-quality-sheet">
      <SC_QualityRow
        v-for="q in rows"
        :key="q.height"
        type="button"
        :disabled="starting || !q.fits"
        :data-testid="`offline-quality-${q.height}`"
        @click="pick(q.height)"
      >
        <span>{{ q.height ? `${q.height}p` : t('offlineVideo.qualityAudio') }}</span>
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
// дальше качается сразу запомненное (ближайшее не выше). Для пачки роликов
// (коллекция, плейлист) — то же, размер — сколько займут все.

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Checkbox, Modal } from 'ant-design-vue'
import { formatBytes } from '@/services/offline-video/format-bytes'
import { useOfflineVideosStore } from '@/stores/offline-videos-store'
import { OFFLINE_SPARE_BYTES, useOfflineDownload } from './use-offline-download'
import { SC_QualityRow, SC_SheetBody, SC_SheetFooter } from './offline-video.styled'

const { t, locale } = useI18n()
const store = useOfflineVideosStore()
const { begin, beginMany } = useOfflineDownload()
const remember = ref(false)
const starting = ref(false)

const choice = computed(() => store.sheet)
const batch = computed(() => store.batchSheet)
watch([choice, batch], () => {
  remember.value = false
})

const title = computed(() => {
  const n = batch.value?.choices.length ?? 0
  return n ? t('offlineVideo.batchQualityTitle', { n }, n) : t('offlineVideo.qualityTitle')
})

const free = computed(() => (batch.value ? batch.value.free : (choice.value?.free ?? null)))

const rows = computed(() => {
  const list = batch.value ? batch.value.rows : (choice.value?.qualities ?? [])
  return list.map(({ height, size }) => ({
    height,
    sizeText: size ? formatBytes(size, locale.value) : '',
    fits: free.value === null || !size || free.value >= size + OFFLINE_SPARE_BYTES,
  }))
})

const freeText = computed(() => (free.value === null ? '' : formatBytes(free.value, locale.value)))

function close(): void {
  store.closeSheet()
  store.closeBatchSheet()
}

async function pick(height: number): Promise<void> {
  if (remember.value) store.setQualityPref(height)
  starting.value = true
  try {
    const b = batch.value
    const c = choice.value
    const quality = c?.qualities.find((q) => q.height === height)
    const ok = b ? await beginMany(b, height) : !!c && !!quality && (await begin(c, quality))
    if (ok) close()
  } finally {
    starting.value = false
  }
}
</script>
