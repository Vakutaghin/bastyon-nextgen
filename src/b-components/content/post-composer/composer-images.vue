<template>
  <SC_ImagesBlock :class="{ disabled }" :aria-busy="disabled || undefined">
    <!-- Раскладка — та же, что у поста в ленте (layoutImageGrid): сразу видно,
         как картинки встанут вместе. Координаты плиток — inline, как в ленте:
         свои у каждой плитки. -->
    <SC_Collage v-if="images.length" :style="collageStyle" data-testid="composer-images">
      <SC_CollageTile
        v-for="(cell, idx) in cells"
        :key="cell.img.id"
        :style="tileStyle(cell.tile)"
        :class="{ dragging: dragId === cell.img.id, target: dropIndex === idx }"
        :draggable="canReorder"
        data-testid="composer-image"
        @dragstart="onTileDragStart($event, cell.img.id)"
        @dragover="onTileDragOver($event, idx)"
        @dragleave="onTileDragLeave(idx)"
        @drop="onTileDrop($event, idx)"
        @dragend="onDragEnd"
      >
        <SC_CollageCell :style="cellStyle(cell.tile)">
          <img
            :src="cell.img.base64"
            :alt="t('postComposer.imageAlt')"
            draggable="false"
            @load="onImageLoad($event, cell.img)"
          />
          <SC_ImageRotate
            type="button"
            :aria-label="t('postComposer.rotateImage')"
            :disabled="disabled"
            @click="emit('rotate', cell.img.id)"
          >
            <RotateRightOutlined />
          </SC_ImageRotate>
          <SC_ImageEdit
            type="button"
            :aria-label="t('postComposer.editImage')"
            :disabled="disabled"
            @click="openEditor(cell.img)"
          >
            <EditOutlined />
          </SC_ImageEdit>
          <SC_ImageRemove
            type="button"
            :aria-label="t('postComposer.removeImage')"
            :disabled="disabled"
            @click="emit('remove', cell.img.id)"
          >
            ×
          </SC_ImageRemove>
        </SC_CollageCell>
      </SC_CollageTile>
    </SC_Collage>

    <SC_ImagesFooter>
      <SC_AddTile
        v-if="!full"
        :dragover="dragover && !disabled"
        :class="{ disabled }"
        data-testid="composer-images-add"
        @dragover="onAddDragOver"
        @dragleave.prevent="dragover = false"
        @drop.prevent.stop="onDrop"
      >
        <PlusOutlined />
        {{ t('postComposer.addImages') }}
        <input
          ref="inputRef"
          type="file"
          accept="image/*"
          multiple
          :disabled="disabled"
          @change="onChange"
        />
      </SC_AddTile>
      <SC_ImagesHint>
        {{
          canReorder
            ? t('postComposer.imagesLayoutHintReorder')
            : t('postComposer.imagesLayoutHint')
        }}
      </SC_ImagesHint>
      <HelpLink topic="post-images#layout" />
    </SC_ImagesFooter>
  </SC_ImagesBlock>

  <ImageEditorModal
    :open="!!editingId"
    :image="editingBase64"
    @apply="onEditApply"
    @close="editingId = null"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditOutlined, PlusOutlined, RotateRightOutlined } from '@/components/icons'
import HelpLink from '@/b-components/help/help-link.vue'
import { layoutImageGrid, type GridTile } from '@/helpers/content/image-grid-layout'

import {
  SC_AddTile,
  SC_Collage,
  SC_CollageCell,
  SC_CollageTile,
  SC_ImageEdit,
  SC_ImageRemove,
  SC_ImageRotate,
  SC_ImagesBlock,
  SC_ImagesFooter,
  SC_ImagesHint,
} from './composer-images.styled'
import { COMPOSER_IMAGE_DRAG } from './consts'
import ImageEditorModal from './image-editor-modal.vue'
import type { ComposerImage } from './use-post-images'

const props = defineProps<{
  images: ComposerImage[]
  full: boolean
  /** Идёт публикация: картинки уже грузятся, набор не меняется. */
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'add', files: File[]): void
  (e: 'remove', id: string): void
  (e: 'move', id: string, to: number): void
  (e: 'rotate', id: string): void
  (e: 'edit', payload: { id: string; base64: string }): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const dragover = ref(false)

// ── Раскладка ──────────────────────────────────────────────────────────

/** Высота раскладки в редакторе: окно поста ниже ленты. */
const COLLAGE_MAX_HEIGHT_PX = 420

/**
 * Пропорции по id: картинка своя, data-URL. Ключ — id вместе с адресом:
 * поворот и кадрирование дают новый адрес и новые пропорции.
 */
const ratios = reactive(new Map<string, { src: string; ratio: number }>())

function onImageLoad(event: Event, img: ComposerImage): void {
  const el = event.target as HTMLImageElement | null
  if (!el?.naturalWidth || !el.naturalHeight) return
  ratios.set(img.id, { src: img.base64, ratio: el.naturalWidth / el.naturalHeight })
}

const ratioOf = (img: ComposerImage): number | undefined => {
  const known = ratios.get(img.id)
  return known && known.src === img.base64 ? known.ratio : undefined
}

const layout = computed(() => layoutImageGrid(props.images.map(ratioOf)))
const cells = computed(() =>
  layout.value.tiles.map((tile, i) => ({ tile, img: props.images[i]! })).filter((c) => c.img)
)

const collageStyle = computed<Record<string, string>>(() => {
  const h = layout.value.height || 1
  return {
    aspectRatio: String(1 / h),
    maxWidth: `min(100%, ${(COLLAGE_MAX_HEIGHT_PX / h).toFixed(1)}px)`,
  }
})

const pct = (v: number): string => `${(v * 100).toFixed(4)}%`

function tileStyle(tile: GridTile): Record<string, string> {
  const h = layout.value.height || 1
  return { left: pct(tile.x), top: pct(tile.y / h), width: pct(tile.w), height: pct(tile.h / h) }
}

/** Зазор 2px между соседями: по 1px с каждой внутренней стороны плитки. */
function cellStyle(tile: GridTile): Record<string, string> {
  const eps = 1e-3
  const inner = (v: boolean): string => (v ? '1px' : '0')
  return {
    top: inner(tile.y > eps),
    left: inner(tile.x > eps),
    right: inner(tile.x + tile.w < 1 - eps),
    bottom: inner(tile.y + tile.h < layout.value.height - eps),
  }
}

// ── Порядок перетаскиванием ────────────────────────────────────────────

const canReorder = computed<boolean>(() => !props.disabled && props.images.length > 1)
const dragId = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

const ownDrag = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes(COMPOSER_IMAGE_DRAG)

function onTileDragStart(e: DragEvent, id: string): void {
  if (!canReorder.value || !e.dataTransfer) {
    e.preventDefault()
    return
  }
  dragId.value = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(COMPOSER_IMAGE_DRAG, id)
}

function onTileDragOver(e: DragEvent, idx: number): void {
  if (!ownDrag(e) || !dragId.value || props.disabled) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropIndex.value = idx
}

function onTileDragLeave(idx: number): void {
  if (dropIndex.value === idx) dropIndex.value = null
}

function onTileDrop(e: DragEvent, idx: number): void {
  if (!ownDrag(e)) return
  // Своя картинка — только смена порядка, до поля поста бросок не доходит.
  e.preventDefault()
  e.stopPropagation()
  const id = dragId.value ?? e.dataTransfer?.getData(COMPOSER_IMAGE_DRAG)
  if (id && !props.disabled) emit('move', id, idx)
  onDragEnd()
}

function onDragEnd(): void {
  dragId.value = null
  dropIndex.value = null
}

// ── Добавить ───────────────────────────────────────────────────────────

/** Плитка «Добавить» принимает только файлы снаружи и не во время публикации. */
function onAddDragOver(e: DragEvent): void {
  if (props.disabled || ownDrag(e) || !e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragover.value = true
}

// Редактор (crop/фильтры/поворот) — модалка по конкретной картинке.
const editingId = ref<string | null>(null)
const editingBase64 = ref<string>('')

const openEditor = (img: ComposerImage): void => {
  editingId.value = img.id
  editingBase64.value = img.base64
}

const onEditApply = (base64: string): void => {
  if (editingId.value) emit('edit', { id: editingId.value, base64 })
  editingId.value = null
}

const onChange = (e: Event): void => {
  const input = e.target as HTMLInputElement
  if (input.files?.length) emit('add', Array.from(input.files))
  input.value = '' // позволяем повторно выбрать тот же файл
}

/**
 * Бросок на «Добавить». `.stop`: иначе его ловило ещё и поле поста, и файл
 * с диска добавлялся дважды.
 */
const onDrop = (e: DragEvent): void => {
  dragover.value = false
  // Перетаскивание кнопкой не заблокировать — проверяем сами.
  if (props.disabled || ownDrag(e)) return
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
  if (files.length) emit('add', files)
}
</script>
