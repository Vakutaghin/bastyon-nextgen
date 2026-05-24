<template>
  <HashLink
    :hash='address'
    :to='to'
    :full='full'
    :copyable='copyable'
    :head='head'
    :tail='tail'
  />
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import HashLink from './hash-link.vue'

const p = withDefaults(
  defineProps<{
    address: string
    full?: boolean
    copyable?: boolean
    head?: number
    tail?: number
  }>(),
  {
    full: false,
    copyable: true,
    head: 6,
    tail: 6,
  },
)

const to = computed(() =>
  p.address
    ? { name: 'explorer-address', params: { address: p.address } }
    : undefined,
)
</script>
