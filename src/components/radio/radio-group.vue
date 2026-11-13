<template>
  <div class="ui-radio-group" role="radiogroup">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Группа радиокнопок вместо antd Radio.Group: общее имя и выбранное значение
// для всех Radio внутри, на любой глубине. Выбор — update:value и change(value)
// (у antd change приходил событием с e.target.value).
import { computed, provide, useId } from 'vue'
import { RADIO_GROUP, type RadioValue } from './radio'

const p = withDefaults(defineProps<{ value?: RadioValue; name?: string; disabled?: boolean }>(), {
  value: undefined,
  name: undefined,
  disabled: false,
})
const emit = defineEmits<{
  (e: 'update:value', value: RadioValue): void
  (e: 'change', value: RadioValue): void
}>()

const autoName = useId()

provide(RADIO_GROUP, {
  name: p.name ?? autoName,
  value: computed(() => p.value),
  disabled: computed(() => p.disabled),
  select: (value) => {
    emit('update:value', value)
    emit('change', value)
  },
})
</script>
