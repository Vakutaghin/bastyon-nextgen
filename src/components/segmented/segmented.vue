<template>
  <SC_Segmented
    class="ui-segmented"
    role="radiogroup"
    :data-size="size"
    :data-block="block ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
  >
    <div ref="group" class="ui-segmented__group">
      <span ref="thumb" class="ui-segmented__thumb" aria-hidden="true" />
      <button
        v-for="(o, i) in items"
        :key="String(o.value)"
        type="button"
        role="radio"
        class="ui-segmented__item"
        :aria-checked="i === selectedIndex ? 'true' : 'false'"
        :tabindex="tabIndexOf(i)"
        :disabled="isDisabled(o)"
        @click="select(o)"
        @keydown="onKey($event, i)"
      >
        <span class="ui-segmented__label" :title="o.label">{{ o.label }}</span>
      </button>
    </div>
  </SC_Segmented>
</template>

<script setup lang="ts">
// Переключатель вариантов вместо antd Segmented: группа кнопок-радио,
// стрелки выбирают соседний вариант, подложка выбранного едет к нему.
// Имя группы для диктора — aria-label у потребителя.
import { ref } from 'vue'
import { useSegmented } from './segmented'
import type { SegmentedEmits, SegmentedProps } from './types'
import { SC_Segmented } from './styled'

const p = withDefaults(defineProps<SegmentedProps>(), {
  value: undefined,
  disabled: false,
  block: false,
  size: 'default',
})
const emit = defineEmits<SegmentedEmits>()

const group = ref<HTMLElement | null>(null)
const thumb = ref<HTMLElement | null>(null)
const { items, selectedIndex, tabIndexOf, isDisabled, select, onKey } = useSegmented(
  p,
  emit,
  group,
  thumb
)
</script>
