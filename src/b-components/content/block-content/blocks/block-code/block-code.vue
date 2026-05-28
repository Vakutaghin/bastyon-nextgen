<template>
  <SC_BlockCode
    ><SC_BlockCodeCode>{{ decodedCode }}</SC_BlockCodeCode></SC_BlockCode
  >
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SC_BlockCode, SC_BlockCodeCode } from './styled'

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
  try {
    return decodeURIComponent(String(code))
  } catch {
    return String(code)
  }
})
</script>
