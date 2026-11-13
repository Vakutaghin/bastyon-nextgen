<template>
  <SC_Radio class="ui-radio" :data-disabled="isDisabled ? '' : undefined">
    <span class="ui-radio__control">
      <input
        v-bind="$attrs"
        type="radio"
        class="ui-radio__input"
        :name="group?.name"
        :value="value"
        :checked="isChecked"
        :disabled="isDisabled"
        @change="onChange"
      />
      <span class="ui-radio__circle" aria-hidden="true" />
    </span>
    <span v-if="$slots.default" class="ui-radio__label"><slot /></span>
  </SC_Radio>
</template>

<script setup lang="ts">
// Радиокнопка вместо antd Radio: настоящий <input type="radio"> под своим
// кружком, подпись — слотом внутри <label>. Имя и выбранное значение берёт у
// RadioGroup, поэтому стрелки между кнопками группы работают сами.
import { computed } from 'vue'
import { useRadioGroupContext, type RadioValue } from './radio'
import { SC_Radio } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<{ value: RadioValue; disabled?: boolean }>(), {
  disabled: false,
})

const group = useRadioGroupContext()
const isChecked = computed(() => group?.value.value === p.value)
const isDisabled = computed(() => p.disabled || Boolean(group?.disabled.value))

function onChange(e: Event): void {
  if ((e.target as HTMLInputElement).checked) group?.select(p.value)
}
</script>
