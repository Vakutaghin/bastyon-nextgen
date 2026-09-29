<template>
  <!-- Только в Tauri: кнопка и функционал загрузки видео -->
  <!-- Кнопка только со значком: подпись — в title и aria-label, иначе её не
       прочитает экранный диктор и не объяснит подсказка при наведении. -->
  <SC_FabButton
    v-if="isTauriEnv"
    type="button"
    :title="t('videoUploader.title')"
    :aria-label="t('videoUploader.title')"
    @click.prevent.stop="$emit('click')"
  >
    <VideoCameraAddOutlined :style="ICON_SIZE_XXL" />
  </SC_FabButton>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFabButton } from './fab-button'
import type { FabButtonEmits } from './types'
import { ICON_SIZE_XXL } from '@/styles/icon-styles'

defineEmits<FabButtonEmits>()

const { t } = useI18n()
const { VideoCameraAddOutlined, SC_FabButton, isTauriEnv } = useFabButton()
</script>
