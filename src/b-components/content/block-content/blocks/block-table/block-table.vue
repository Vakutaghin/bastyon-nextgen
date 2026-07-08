<!-- SC_BlockTable*Cell — styled.th/td; содержимое ячеек прогнано через sanitizeHtml (P1-2). -->
<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <SC_BlockTableWrapper>
    <SC_BlockTable>
      <thead v-if="hasHeader">
        <tr>
          <SC_BlockTableHeaderCell
            v-for="(cell, idx) in headerRow"
            :key="idx"
            v-html="formatCell(cell)"
          />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in bodyRows" :key="rowIndex">
          <SC_BlockTableCell
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
            v-html="formatCell(cell)"
          />
        </tr>
      </tbody>
    </SC_BlockTable>
  </SC_BlockTableWrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeHtml } from '@/helpers/content/sanitize-html'
import {
  SC_BlockTableWrapper,
  SC_BlockTable,
  SC_BlockTableHeaderCell,
  SC_BlockTableCell,
} from './styled'

interface BlockTableData {
  content?: string[][]
  withHeadings?: boolean
}

interface BlockTableBlock {
  type: string
  id: string
  data: BlockTableData
}

const props = defineProps<{
  block: BlockTableBlock
  index?: number
}>()

const content = computed<string[][]>(() => props.block.data?.content || [])
const hasHeader = computed<boolean>(() => props.block.data?.withHeadings === true)
const headerRow = computed<string[]>(() =>
  hasHeader.value && content.value.length > 0 ? (content.value[0] ?? []) : []
)
const bodyRows = computed<string[][]>(() =>
  hasHeader.value ? content.value.slice(1) : content.value
)

function formatCell(cell: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(String(cell))
  } catch {
    decoded = String(cell)
  }
  // Содержимое ячейки — недоверенный контент из блокчейна; рендерится через
  // v-html, поэтому обязателен whitelist-прогон (P1-2).
  return sanitizeHtml(decoded.replace(/\n/g, '<br>'))
}
</script>
