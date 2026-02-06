<template>
  <SC_Spin>
    <Spin v-bind='$attrs' :class="['bastyon-spin', spinClass]">
      <template #indicator>
        <slot name='indicator'>
          <LoadingOutlined spin />
        </slot>
      </template>
      <slot />
    </Spin>
  </SC_Spin>
</template>

<script setup lang='ts'>
import { useSpin } from './spin'
import type { SpinProps } from './types'

const p = defineProps<SpinProps>()

const { Spin, LoadingOutlined, SC_Spin, spinClass } = useSpin(p)
</script>
