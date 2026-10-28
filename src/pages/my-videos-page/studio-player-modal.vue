<template>
  <!-- Ролик прямо из «Медиастудии», тем же плеером, что в ленте, — и у ролика
       без поста. Поверх окна ролика (1100): смотрят и оттуда. -->
  <Modal
    :open="true"
    :footer="null"
    :width="960"
    :z-index="1150"
    centered
    wrap-class-name="studio-player-modal"
    @cancel="emit('close')"
  >
    <template #title>
      <SC_PlayerTitle :title="video.name">{{ video.name }}</SC_PlayerTitle>
    </template>
    <VideoPlayer
      :video-url="video.pointer"
      autoplay
      :is-audio="video.isAudio"
      :title="video.name"
      data-testid="studio-player"
    />
  </Modal>
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { Modal } from 'ant-design-vue'
import VideoPlayer from '@/b-components/content/video-player/video-player.vue'
import type { ServerVideo } from './use-server-videos'
import { SC_PlayerTitle } from './studio-player-modal.styled'

defineProps<{ video: ServerVideo }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Окно открывают с обложки, и фокус оставался на ней, под окном: Escape не
// закрывал окно, а клавиши плеера уходили странице. Переводим фокус в окно.
onMounted(async () => {
  await nextTick()
  const wrap = document.querySelector<HTMLElement>('.studio-player-modal')
  if (wrap && !wrap.contains(document.activeElement)) wrap.focus({ preventScroll: true })
})
</script>
