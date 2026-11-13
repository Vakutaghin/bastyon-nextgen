<template>
  <SC_Checkbox class="ui-checkbox" :data-disabled="disabled ? '' : undefined">
    <span class="ui-checkbox__control">
      <input
        v-bind="$attrs"
        type="checkbox"
        class="ui-checkbox__input"
        :checked="checked"
        :disabled="disabled"
        @change="onChange"
      />
      <span class="ui-checkbox__box" aria-hidden="true" />
    </span>
    <span v-if="$slots.default" class="ui-checkbox__label"><slot /></span>
  </SC_Checkbox>
</template>

<script setup lang="ts">
// Флажок вместо antd Checkbox: настоящий <input type="checkbox"> под своим
// квадратом, подпись — слотом внутри <label>, поэтому нажатие по подписи
// переключает. Атрибуты потребителя (aria-*, id, data-testid) — на input.
import type { CheckboxEmits, CheckboxProps } from './types'
import { SC_Checkbox } from './styled'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<CheckboxProps>(), { checked: false, disabled: false })
const emit = defineEmits<CheckboxEmits>()

function onChange(e: Event): void {
  const checked = (e.target as HTMLInputElement).checked
  emit('update:checked', checked)
  emit('change', checked)
}
</script>
