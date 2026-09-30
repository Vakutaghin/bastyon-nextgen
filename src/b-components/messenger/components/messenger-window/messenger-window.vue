<template>
  <SC_Window ref="windowRef" :is-open="isOpen" :class="{ resizing }">
    <!-- Окно прижато к правому нижнему углу: тянется влево и вверх. -->
    <SC_ResizeEdge class="left" aria-hidden="true" @pointerdown="startResize($event, WIDTH)" />
    <SC_ResizeEdge class="top" aria-hidden="true" @pointerdown="startResize($event, HEIGHT)" />
    <SC_ResizeCorner
      class="resize-corner"
      role="button"
      tabindex="0"
      :aria-label="t('messenger.resizeWindow')"
      :title="t('messenger.resizeWindow')"
      @pointerdown="startResize($event, BOTH)"
      @dblclick="resetSize"
      @keydown="resizeByKey"
    />

    <SC_Header>
      <slot name="actions" />
      <SC_Title :title="title">{{ title }}</SC_Title>
      <SC_CloseButton type="button" :aria-label="t('chat.close')" @click="emit('close')">
        <CloseOutlined />
      </SC_CloseButton>
    </SC_Header>

    <SC_Content>
      <slot />
    </SC_Content>
  </SC_Window>
</template>

<script setup lang="ts">
import { ref, watchPostEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SC_Window,
  SC_Header,
  SC_Title,
  SC_Content,
  SC_CloseButton,
  SC_ResizeCorner,
  SC_ResizeEdge,
} from './styled'
import { CloseOutlined } from '@/components/icons'
import { useWidgetSize, type ResizeAxes } from './use-widget-size'

const WIDTH: ResizeAxes = { width: true, height: false }
const HEIGHT: ResizeAxes = { width: false, height: true }
const BOTH: ResizeAxes = { width: true, height: true }

const { t } = useI18n()

withDefaults(defineProps<{ isOpen: boolean; title?: string }>(), { title: 'Messenger' })
const emit = defineEmits<{ close: [] }>()

const { size, resizing, startResize, resizeByKey, resetSize } = useWidgetSize()

/** Поле ввода растёт до 30 % высоты окна, но не ниже прежних 125px. */
const INPUT_MAX_SHARE = 0.3
const INPUT_MAX_MIN = 125

// Размер меняется на каждое движение мыши, поэтому пишется прямо в стиль
// окна (как громкость у кнопки голосового ввода), а не классом styled:
// тот плодил бы по классу на каждый пиксель.
const windowRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
watchPostEffect(() => {
  const r = windowRef.value
  const el = r instanceof HTMLElement ? r : (r?.$el ?? null)
  if (!el) return
  const { width, height } = size.value
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  el.style.setProperty(
    '--chat-input-max-height',
    `${Math.max(INPUT_MAX_MIN, Math.round(height * INPUT_MAX_SHARE))}px`
  )
})
</script>
