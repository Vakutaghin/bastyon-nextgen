<template>
  <!-- Только в Tauri: кнопка и функционал загрузки видео -->
  <SC_FabButton v-if="isTauriEnv" type="button" @click.prevent.stop="$emit('click')">
    <VideoCameraAddOutlined :style="ICON_SIZE_XXL" />
  </SC_FabButton>
</template>

<script setup lang="ts">
import { useFabButton } from './fab-button'
import type { FabButtonEmits } from './types'
import { ICON_SIZE_XXL } from '@/styles/icon-styles'

defineEmits<FabButtonEmits>()

const { VideoCameraAddOutlined, SC_FabButton, isTauriEnv } = useFabButton()
</script>
