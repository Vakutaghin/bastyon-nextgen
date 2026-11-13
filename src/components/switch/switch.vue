<template>
  <SC_Switch
    type="button"
    role="switch"
    class="ui-switch"
    :aria-checked="isOn ? 'true' : 'false'"
    :aria-busy="loading ? 'true' : undefined"
    :disabled="blocked"
    :data-size="size"
    :data-state="isOn ? 'on' : 'off'"
    @click="toggle"
  >
    <span class="ui-switch__thumb">
      <LoadingOutlined v-if="loading" class="ui-switch__spinner" />
    </span>
  </SC_Switch>
</template>

<script setup lang="ts">
// Переключатель вместо antd Switch: настоящая кнопка role="switch", Пробел и
// Enter работают сами. Имя для диктора — aria-label у потребителя.
import { LoadingOutlined } from '@/components/icons'
import { useSwitch } from './switch'
import type { SwitchEmits, SwitchProps } from './types'
import { SC_Switch } from './styled'

const p = withDefaults(defineProps<SwitchProps>(), {
  checked: undefined,
  disabled: false,
  loading: false,
  size: 'default',
})
const emit = defineEmits<SwitchEmits>()

const { isOn, blocked, toggle } = useSwitch(p, emit)
</script>
