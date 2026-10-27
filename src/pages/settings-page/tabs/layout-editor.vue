<template>
  <div>
    <SC_LayoutList ref="listRef" :aria-label="title">
      <SC_LayoutRow
        v-for="(entry, index) in entries"
        :key="entry.id"
        :data-layout-id="entry.id"
        :class="{ dragging: dragIndex === index, off: !entry.visible || !!reasonOf(entry.id) }"
      >
        <SC_DragHandle
          type="button"
          :aria-label="t('settings.layout.handle', { name: labelOf(entry.id) })"
          :aria-describedby="hintId"
          @pointerdown="onPointerDown($event, index)"
          @keydown="onHandleKey($event, index)"
        >
          <DragHandleIcon />
        </SC_DragHandle>
        <SC_RowIcon class="layout-row-icon" aria-hidden="true">
          <component :is="items[entry.id]!.icon" />
        </SC_RowIcon>
        <SC_RowText>
          <SC_RowLabel class="layout-row-label">{{ labelOf(entry.id) }}</SC_RowLabel>
          <SC_RowNote v-if="noteFor(entry.id)">{{ noteFor(entry.id) }}</SC_RowNote>
        </SC_RowText>
        <Switch
          :checked="entry.visible && !reasonOf(entry.id)"
          :disabled="!!reasonOf(entry.id) || !!lockedOf?.(entry.id)"
          :aria-label="t('settings.layout.show', { name: labelOf(entry.id) })"
          @change="emit('toggle', entry.id, Boolean($event))"
        />
      </SC_LayoutRow>
    </SC_LayoutList>

    <SC_LayoutFooter>
      <span :id="hintId">{{ t('settings.layout.dragHint') }}</span>
      <SC_ResetButton type="button" :disabled="!customized" @click="emit('reset')">
        {{ t('settings.layout.reset') }}
      </SC_ResetButton>
    </SC_LayoutFooter>

    <!-- Куда встал пункт после стрелки — для экранного диктора. -->
    <span class="visually-hidden" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<script setup lang="ts">
// Список-конструктор: порядок — перетаскиванием за ручку (мышью и пальцем,
// pointer-события) или стрелками на ручке, видимость — переключателем.
// Пункт, которого здесь нет, виден с причиной, выключен и не включается
// (сохранённый выбор не теряется: включат мессенджер — пункт вернётся);
// закреплённый не выключается.

import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Switch } from 'ant-design-vue'
import { DragHandleIcon } from '@/components/icons'
import type { LayoutEntry } from '@/stores/header-layout'
import type { LayoutItemMeta } from '@/b-components/header/header-layout/layout-items'
import {
  SC_DragHandle,
  SC_LayoutFooter,
  SC_LayoutList,
  SC_LayoutRow,
  SC_ResetButton,
  SC_RowIcon,
  SC_RowLabel,
  SC_RowNote,
  SC_RowText,
} from './layout-editor.styled'

const props = defineProps<{
  title: string
  entries: LayoutEntry[]
  items: Record<string, LayoutItemMeta>
  /** i18n-ключ причины, почему пункта на этой платформе нет; null — есть. */
  reasonOf: (id: string) => string | null
  /** Пояснение к пункту (i18n-ключ), когда причины нет. */
  noteOf?: (id: string) => string | null
  lockedOf?: (id: string) => boolean
  /** Есть своя раскладка — «Вернуть по умолчанию» доступна. */
  customized: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string, visible: boolean]
  move: [from: number, to: number]
  reset: []
}>()

const { t } = useI18n()
const hintId = useId()

function labelOf(id: string): string {
  const meta = props.items[id]!
  return meta.label ?? t(meta.labelKey!)
}

function noteFor(id: string): string {
  const key = props.reasonOf(id) ?? props.noteOf?.(id) ?? null
  return key ? t(key) : ''
}

// --- Перетаскивание ---
const listRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const dragIndex = ref<number | null>(null)
/** Ход уже отправлен, а строки ещё не перерисованы: следующий — после отрисовки. */
let settling = false

function listEl(): HTMLElement | null {
  const r = listRef.value
  return r instanceof HTMLElement ? r : (r?.$el ?? null)
}

/**
 * Движение слушаем на окне, а не на ручке: строка при перестановке переезжает
 * в DOM, и захват указателя на ней сбросился бы посреди перетаскивания.
 */
function onPointerDown(event: PointerEvent, index: number): void {
  if (event.button !== 0) return
  event.preventDefault()
  dragIndex.value = index
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

/**
 * Место под указателем — сколько других строк выше него серединой. Строка
 * перескакивает туда сразу: что получится, видно по ходу движения.
 */
function onPointerMove(event: PointerEvent): void {
  const from = dragIndex.value
  const list = listEl()
  if (from === null || !list || settling) return
  const rows = Array.from(list.children) as HTMLElement[]
  let to = 0
  rows.forEach((row, i) => {
    if (i === from) return
    const rect = row.getBoundingClientRect()
    if (rect.top + rect.height / 2 < event.clientY) to++
  })
  if (to === from) return
  settling = true
  emit('move', from, to)
  dragIndex.value = to
  void nextTick(() => {
    settling = false
  })
}

function onPointerUp(): void {
  dragIndex.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

onBeforeUnmount(onPointerUp)

// --- Клавиатура ---
const announcement = ref('')

function onHandleKey(event: KeyboardEvent, index: number): void {
  const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (!step) return
  event.preventDefault()
  const to = index + step
  if (to < 0 || to >= props.entries.length) return
  const id = props.entries[index]!.id
  emit('move', index, to)
  announcement.value = t('settings.layout.moved', {
    name: labelOf(id),
    pos: to + 1,
    total: props.entries.length,
  })
  // Строка переехала — фокус остаётся на её ручке, можно жать дальше.
  void nextTick(() => {
    const handle = listEl()?.querySelector<HTMLElement>(`[data-layout-id="${id}"] button`)
    handle?.focus()
  })
}
</script>
