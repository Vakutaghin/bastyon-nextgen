<template>
  <SC_BlockCode
    ><SC_BlockCodeCode>{{ decodedCode }}</SC_BlockCodeCode></SC_BlockCode
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_BlockCode, SC_BlockCodeCode } from './styled'
import { safeDecode } from '@/helpers/content/safe-decode'

interface BlockCodeData {
  code?: string
  text?: string
}

interface BlockCodeBlock {
  type: string
  id: string
  data: BlockCodeData
}

const props = defineProps<{
  block: BlockCodeBlock
  index?: number
}>()

const decodedCode = computed<string>(() => {
  const code = props.block.data.code || props.block.data.text || ''
  return safeDecode(String(code))
})
</script>
