import { defineComponent, type PropType } from 'vue'
import { SC_BlockTableWrapper, SC_BlockTable, SC_BlockTableHeaderCell, SC_BlockTableCell } from './styled'

interface BlockTableData {
  content?: string[][]
  withHeadings?: boolean
}

interface BlockTableBlock {
  type: string
  id: string
  data: BlockTableData
}

export const blockTableOptions = defineComponent({
  name: 'BlockTable',
  components: {
    SC_BlockTableWrapper,
    SC_BlockTable,
    SC_BlockTableHeaderCell,
    SC_BlockTableCell
  },
  props: {
    block: {
      type: Object as PropType<BlockTableBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Данные таблицы
     */
    tableData(): BlockTableData {
      return this.block.data || {}
    },
    /**
     * Содержимое таблицы (массив строк)
     */
    content(): string[][] {
      return this.tableData.content || []
    },
    /**
     * Есть ли заголовок
     */
    hasHeader(): boolean {
      return this.tableData.withHeadings === true
    },
    /**
     * Первая строка (заголовок)
     */
    headerRow(): string[] {
      return this.hasHeader && this.content.length > 0 ? this.content[0] : []
    },
    /**
     * Строки тела таблицы
     */
    bodyRows(): string[][] {
      return this.hasHeader ? this.content.slice(1) : this.content
    }
  },
  methods: {
    /**
     * Форматирует ячейку таблицы (декодирует URL-encoded текст)
     */
    formatCell(cell: string): string {
      try {
        const decoded = decodeURIComponent(String(cell))
        return decoded.replace(/\n/g, '<br>')
      } catch {
        return String(cell).replace(/\n/g, '<br>')
      }
    }
  }
})
