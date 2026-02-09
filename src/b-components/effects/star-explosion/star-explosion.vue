<template>
  <SC_StarExplosionContainer ref="container" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SC_StarExplosionContainer } from './styled'
import { useStarExplosion } from './use-star-explosion'

const container = ref<HTMLElement | { $el: HTMLElement } | null>(null)

useStarExplosion(container)
</script>
