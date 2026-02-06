import { defineComponent, type PropType } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockList, SC_BlockListItem } from './styled'

interface BlockListData {
  style?: 'ordered' | 'unordered'
  items?: string[]
}

interface BlockListBlock {
  type: string
  id: string
  data: BlockListData
}

export const blockListOptions = defineComponent({
  name: 'BlockList',
  components: {
    SC_BlockList,
    SC_BlockListItem
  },
  props: {
    block: {
      type: Object as PropType<BlockListBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Тег списка (ul или ol) в зависимости от типа
     */
    listTag(): string {
      const style = this.block.data.style || 'unordered'
      return style === 'ordered' ? 'ol' : 'ul'
    },
    /**
     * Стиль списка
     */
    listStyle(): string {
      return this.block.data.style || 'unordered'
    },
    /**
     * Элементы списка
     */
    listItems(): string[] {
      const items = this.block.data.items || []
      return Array.isArray(items) ? items : []
    },
    /**
     * Класс для стиля списка
     */
    listStyleClass(): string {
      const style = this.listStyle
      if (style === 'unordered') {
        return 'blockListUnordered'
      } else if (style === 'ordered') {
        return 'blockListOrdered'
      }
      return 'blockListUnordered'
    }
  },
  methods: {
    /**
     * Форматирует элемент списка (декодирует URL-encoded текст и преобразует bastyon:// ссылки)
     */
    formatItem(item: string): string {
      let decoded = ''
      try {
        decoded = decodeURIComponent(String(item))
      } catch {
        decoded = String(item)
      }
      let formatted = decoded.replace(/\n/g, '<br>')
      // Преобразуем bastyon:// ссылки в кликабельные ссылки
      formatted = formatBastyonLinks(formatted)
      return formatted
    }
  }
})
