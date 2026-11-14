<template>
  <Tooltip :title="text" placement="top" overlay-class="explorer-info-tooltip">
    <SC_InfoTooltipIcon><QuestionCircleOutlined /></SC_InfoTooltipIcon>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Tooltip from '@/components/tooltip'
import { QuestionCircleOutlined } from '@/components/icons'
import { EXPLORER_GLOSSARY, type GlossaryTerm } from './explorer-glossary'
import { SC_InfoTooltipIcon } from './info-tooltip.styled'

const { t } = useI18n()

const p = defineProps<{
  /** Ключ из EXPLORER_GLOSSARY. Если передан term — игнорируется. */
  termKey?: GlossaryTerm
  /** Произвольный текст. Если задан — имеет приоритет над termKey. */
  text?: string
}>()

const text = computed((): string => {
  if (p.text) return p.text
  if (p.termKey) return t(EXPLORER_GLOSSARY[p.termKey])
  return ''
})
</script>
