<template>
  <SC_TextArea
    v-bind="rootAttrs"
    class="ui-textarea"
    :data-status="status"
    :data-disabled="disabled ? '' : undefined"
    :data-auto-size="rows ? '' : undefined"
  >
    <textarea
      ref="control"
      class="ui-textarea__control"
      :value="current"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      :maxlength="maxlength"
      :aria-invalid="status === 'error' ? 'true' : undefined"
      @input="onInput"
      v-bind="controlAttrs"
    />
    <span v-if="showCount" class="ui-textarea__count" aria-hidden="true">{{ countText }}</span>
  </SC_TextArea>
</template>

<script setup lang="ts">
// Многострочное поле вместо antd Input.TextArea: autoSize растит высоту по
// тексту в пределах строк, счётчик — под полем справа. Атрибуты потребителя
// (id, autocomplete, spellcheck) — на сам textarea.
import { ref } from 'vue'
import { useSplitAttrs } from '../input/input'
import { useTextArea } from './textarea'
import type { TextAreaEmits, TextAreaProps } from './types'
import { SC_TextArea } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<TextAreaProps>(), {
  disabled: false,
  readonly: false,
  autofocus: false,
  showCount: false,
  autoSize: false,
})
const emit = defineEmits<TextAreaEmits>()

const control = ref<HTMLTextAreaElement | null>(null)
const { rootAttrs, controlAttrs } = useSplitAttrs()
const { current, countText, rows, onInput, expose } = useTextArea(p, emit, control)

defineExpose(expose)
</script>
