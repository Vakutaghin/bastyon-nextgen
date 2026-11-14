<template>
  <SC_Input
    v-bind="rootAttrs"
    class="ui-input"
    :data-status="status"
    :data-disabled="disabled ? '' : undefined"
  >
    <span v-if="$slots.prefix" class="ui-input__prefix"><slot name="prefix" /></span>
    <!-- Свои обработчики раньше атрибутов: обработчик @input потребителя, как
         у antd, видит событие уже после update:value и может поправить значение. -->
    <input
      ref="control"
      class="ui-input__control"
      :type="type"
      :value="current"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      :maxlength="maxlength"
      :aria-invalid="status === 'error' ? 'true' : undefined"
      @input="onInput"
      @keydown="onKeydown"
      v-bind="controlAttrs"
    />
    <span v-if="hasSuffix" class="ui-input__suffix">
      <!-- Крестик вне Tab, как у antd: стереть можно и с клавиатуры. Нажатие
           не уводит фокус из поля. Пустое поле — крестик скрыт, место за ним. -->
      <button
        v-if="clearable"
        type="button"
        tabindex="-1"
        class="ui-input__clear"
        :data-hidden="current ? undefined : ''"
        :aria-label="t('a11y.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseCircleFilled />
      </button>
      <span v-if="showCount" class="ui-input__count">{{ countText }}</span>
    </span>
  </SC_Input>
</template>

<script setup lang="ts">
// Однострочное поле вместо antd Input. Рамку и фон рисует корень, input внутри
// прозрачный: значок слева, крестик и счётчик справа — в одной рамке.
import { ref } from 'vue'
import { t } from '@/i18n'
import { CloseCircleFilled } from '@/components/icons'
import { useInput, useSplitAttrs } from './input'
import type { InputEmits, InputProps } from './types'
import { SC_Input } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<InputProps>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  autofocus: false,
  allowClear: false,
  showCount: false,
})
const emit = defineEmits<InputEmits>()

const control = ref<HTMLInputElement | null>(null)
const { rootAttrs, controlAttrs } = useSplitAttrs()
const { current, countText, clearable, hasSuffix, onInput, onKeydown, clear, expose } = useInput(
  p,
  emit,
  control
)

defineExpose(expose)
</script>
