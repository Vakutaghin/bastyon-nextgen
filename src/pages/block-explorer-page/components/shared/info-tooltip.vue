<template>
  <ATooltip
    :title='text'
    placement='top'
    :overlay-style="{ maxWidth: '320px' }"
  >
    <SC_InfoTooltipIcon>?</SC_InfoTooltipIcon>
  </ATooltip>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { Tooltip as ATooltip } from 'ant-design-vue'
import { EXPLORER_GLOSSARY } from './explorer-glossary'
import { SC_InfoTooltipIcon } from './info-tooltip.styled'

const p = defineProps<{
  /** Ключ из EXPLORER_GLOSSARY. Если передан term — игнорируется. */
  termKey?: keyof typeof EXPLORER_GLOSSARY
  /** Произвольный текст. Если задан — имеет приоритет над termKey. */
  text?: string
}>()

const text = computed((): string => {
  if (p.text) return p.text
  if (p.termKey) return EXPLORER_GLOSSARY[p.termKey] ?? ''
  return ''
})
</script>
