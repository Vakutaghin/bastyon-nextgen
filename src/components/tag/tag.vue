<template>
  <SC_Tag>
    <Tag v-bind='$attrs' :class="['bastyon-tag', tagClass]">
      <slot />
    </Tag>
  </SC_Tag>
</template>

<script setup lang='ts'>
import { useTag } from './tag'
import type { TagProps } from './types'

const p = defineProps<TagProps>()

const { Tag, SC_Tag, tagClass } = useTag(p)
</script>
