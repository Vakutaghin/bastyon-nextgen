<template>
  <SC_FabButton v-if="isTauriEnv" @click="$emit('click')">
    <VideoCameraAddOutlined :style="{ fontSize: '24px' }" />
  </SC_FabButton>
</template>

<script setup lang="ts">
import { useFabButton } from './fab-button'
import type { FabButtonEmits } from './types'

defineEmits<FabButtonEmits>()

const { VideoCameraAddOutlined, SC_FabButton, isTauriEnv } = useFabButton()
</script>
