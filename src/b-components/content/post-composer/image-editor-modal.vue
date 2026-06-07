<template>
  <SC_Backdrop v-if="open" @click.self="emit('close')">
    <SC_Dialog>
      <SC_Stage>
        <SC_StageInner ref="stageRef">
          <SC_StageImg :src="working" :css-filter="filterCss" alt="" draggable="false" />
          <SC_CropBox v-if="cropEnabled" ref="cropBoxRef" @pointerdown.stop="startMove">
            <SC_CropHandle @pointerdown.stop="startResize" />
          </SC_CropBox>
        </SC_StageInner>
      </SC_Stage>

      <SC_Toolbar>
        <SC_ToolBtn type="button" @click="rotate(-90)">
          <RotateLeftOutlined /> {{ t('imageEditor.rotateLeft') }}
        </SC_ToolBtn>
        <SC_ToolBtn type="button" @click="rotate(90)">
          <RotateRightOutlined /> {{ t('imageEditor.rotateRight') }}
        </SC_ToolBtn>
        <SC_ToolBtn type="button" :active="cropEnabled" @click="toggleCrop">
          <ExpandOutlined /> {{ t('imageEditor.crop') }}
        </SC_ToolBtn>
      </SC_Toolbar>

      <SC_FilterRow>
        <SC_FilterChip
          v-for="preset in FILTER_PRESETS"
          :key="preset.key"
          type="button"
          :active="filterCss === preset.css"
          @click="filterCss = preset.css"
        >
          {{ t(preset.labelKey) }}
        </SC_FilterChip>
      </SC_FilterRow>

      <SC_Actions>
        <SC_ActionBtn type="button" @click="emit('close')">{{
          t('imageEditor.cancel')
        }}</SC_ActionBtn>
        <SC_ActionBtn type="button" :primary="true" :disabled="busy" @click="apply">
          {{ t('imageEditor.apply') }}
        </SC_ActionBtn>
      </SC_Actions>
    </SC_Dialog>
  </SC_Backdrop>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateLeftOutlined, RotateRightOutlined, ExpandOutlined } from '@ant-design/icons-vue'
import { rotateBase64, applyCropFilter, FILTER_PRESETS, type CropPercent } from './image-transform'
import {
  SC_Backdrop,
  SC_Dialog,
  SC_Stage,
  SC_StageInner,
  SC_StageImg,
  SC_CropBox,
  SC_CropHandle,
  SC_Toolbar,
  SC_ToolBtn,
  SC_FilterRow,
  SC_FilterChip,
  SC_Actions,
  SC_ActionBtn,
} from './image-editor-modal.styled'

const props = defineProps<{ open: boolean; image: string }>()
const emit = defineEmits<{ (e: 'apply', base64: string): void; (e: 'close'): void }>()

const { t } = useI18n()

const working = ref<string>(props.image)
const filterCss = ref<string>('none')
const cropEnabled = ref<boolean>(false)
const crop = ref<CropPercent>({ x: 10, y: 10, w: 80, h: 80 })
const busy = ref(false)
const stageRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const cropBoxRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

// Сброс состояния при каждом открытии.
watch(
  () => [props.open, props.image],
  () => {
    if (props.open) {
      working.value = props.image
      filterCss.value = 'none'
      cropEnabled.value = false
      crop.value = { x: 10, y: 10, w: 80, h: 80 }
    }
  },
  { immediate: true }
)

// Позицию crop-бокса пишем напрямую в DOM (без :style/styled-prop): на драге это
// исключает генерацию класса на каждый кадр и не плодит inline-стили.
function cropBoxEl(): HTMLElement | null {
  const r = cropBoxRef.value
  if (!r) return null
  return r instanceof HTMLElement ? r : (r.$el ?? null)
}
function syncCropBox(): void {
  const el = cropBoxEl()
  if (!el) return
  el.style.left = `${crop.value.x}%`
  el.style.top = `${crop.value.y}%`
  el.style.width = `${crop.value.w}%`
  el.style.height = `${crop.value.h}%`
}

function toggleCrop(): void {
  cropEnabled.value = !cropEnabled.value
  if (cropEnabled.value) void nextTick(syncCropBox)
}

async function rotate(deg: number): Promise<void> {
  try {
    working.value = await rotateBase64(working.value, deg)
  } catch {
    /* noop */
  }
}

// ── Перетаскивание/ресайз бокса кропа (координаты в % от показанного изображения) ──
function stageEl(): HTMLElement | null {
  const r = stageRef.value
  if (!r) return null
  return r instanceof HTMLElement ? r : (r.$el ?? null)
}

let mode: 'move' | 'resize' | null = null
let startX = 0
let startY = 0
let startCrop: CropPercent = { x: 0, y: 0, w: 0, h: 0 }

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

function startMove(e: PointerEvent): void {
  beginDrag('move', e)
}
function startResize(e: PointerEvent): void {
  beginDrag('resize', e)
}
function beginDrag(m: 'move' | 'resize', e: PointerEvent): void {
  mode = m
  startX = e.clientX
  startY = e.clientY
  startCrop = { ...crop.value }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', endDrag)
}
function onMove(e: PointerEvent): void {
  if (!mode) return
  const el = stageEl()
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dx = ((e.clientX - startX) / rect.width) * 100
  const dy = ((e.clientY - startY) / rect.height) * 100
  if (mode === 'move') {
    crop.value = {
      ...crop.value,
      x: clamp(startCrop.x + dx, 0, 100 - startCrop.w),
      y: clamp(startCrop.y + dy, 0, 100 - startCrop.h),
    }
  } else {
    crop.value = {
      ...crop.value,
      w: clamp(startCrop.w + dx, 10, 100 - startCrop.x),
      h: clamp(startCrop.h + dy, 10, 100 - startCrop.y),
    }
  }
  syncCropBox()
}
function endDrag(): void {
  mode = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', endDrag)
}
onBeforeUnmount(endDrag)

async function apply(): Promise<void> {
  busy.value = true
  try {
    const result = await applyCropFilter(
      working.value,
      cropEnabled.value ? crop.value : null,
      filterCss.value
    )
    emit('apply', result)
  } catch {
    emit('apply', working.value)
  } finally {
    busy.value = false
  }
}
</script>
