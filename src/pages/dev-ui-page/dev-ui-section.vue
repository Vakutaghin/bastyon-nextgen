<template>
  <SC_DevUiSection :aria-labelledby="titleId">
    <SC_DevUiSectionTitle :id="titleId">{{ title }}</SC_DevUiSectionTitle>
    <slot />
  </SC_DevUiSection>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { SC_DevUiSection, SC_DevUiSectionTitle } from './dev-ui-page.styled'

defineProps<{ title: string }>()

const titleId = useId()
</script>
