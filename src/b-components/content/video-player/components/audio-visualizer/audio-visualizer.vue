<template>
  <SC_AudioVisualizer ref="container" />
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import type { PropType } from 'vue'
import { SC_AudioVisualizer } from './styled'
import { useAudioVisualizer } from './use-audio-visualizer'

const p = defineProps({
  videoElement: {
    type: Object as PropType<HTMLVideoElement | null>,
    default: null
  },
  isPlaying: {
    type: Boolean,
    default: false
  }
})

const container = ref<HTMLElement | { $el: HTMLElement } | null>(null)

useAudioVisualizer(container, toRef(p, 'videoElement'), toRef(p, 'isPlaying'))
</script>
