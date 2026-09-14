<template>
  <SC_Empty>
    <Empty v-bind="{ ...$attrs, ...forwarded }" :class="['bastyon-empty', emptyClass]">
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <template v-if="$slots.image" #image>
        <slot name="image" />
      </template>
    </Empty>
  </SC_Empty>
</template>

<script setup lang="ts">
import { useEmpty } from './empty'
import type { EmptyProps } from './types'

defineOptions({ inheritAttrs: false })

// `image?: VNodeChild` включает boolean → без default Vue кастует отсутствие в false
// и antd теряет иллюстрацию.
const p = withDefaults(defineProps<EmptyProps>(), { image: undefined })

const { Empty, SC_Empty, emptyClass, forwarded } = useEmpty(p)
</script>
