<template>
  <SC_BlockTableWrapper>
    <SC_BlockTable>
      <thead v-if='hasHeader'>
        <tr>
          <SC_BlockTableHeaderCell 
            v-for='(cell, index) in headerRow' 
            :key='index'
            v-html='formatCell(cell)'
          />
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for='(row, rowIndex) in bodyRows' 
          :key='rowIndex'
        >
          <SC_BlockTableCell 
            v-for='(cell, cellIndex) in row' 
            :key='cellIndex'
            v-html='formatCell(cell)'
          />
        </tr>
      </tbody>
    </SC_BlockTable>
  </SC_BlockTableWrapper>
</template>

<script>
import { blockTableOptions } from './block-table.ts'

export default blockTableOptions
</script>
