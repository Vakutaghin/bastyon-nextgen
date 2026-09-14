<template>
  <SC_Spin>
    <Spin v-bind="{ ...$attrs, ...forwarded }" :class="['bastyon-spin', spinClass]">
      <template #indicator>
        <slot name="indicator">
          <LoadingOutlined spin />
        </slot>
      </template>
      <slot />
    </Spin>
  </SC_Spin>
</template>

<script setup lang="ts">
import { useSpin } from './spin'
import type { SpinProps } from './types'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<SpinProps>(), { spinning: undefined })

const { Spin, LoadingOutlined, SC_Spin, spinClass, forwarded } = useSpin(p)
</script>
