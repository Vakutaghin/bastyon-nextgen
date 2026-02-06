import { defineComponent, type PropType } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockHeader } from './styled'

interface BlockHeaderData {
  level?: number
  text?: string
}

interface BlockHeaderBlock {
  type: string
  id: string
  data: BlockHeaderData
}

export const blockHeaderOptions = defineComponent({
  name: 'BlockHeader',
  components: {
    SC_BlockHeader
  },
  props: {
    block: {
      type: Object as PropType<BlockHeaderBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Тег заголовка в зависимости от уровня (h1, h2, h3, h4, h5, h6)
     */
    headerTag(): string {
      const level = this.block.data.level || 1
      return `h${Math.min(Math.max(level, 1), 6)}`
    },
    /**
     * Декодированный и отформатированный текст заголовка с bastyon:// ссылками
     */
    formattedText(): string {
      const text = this.block.data.text || ''
      let decoded = ''
      try {
        // Пытаемся декодировать URL-encoded строку
        decoded = decodeURIComponent(String(text))
      } catch {
        // Если не удалось декодировать, возвращаем как есть
        decoded = String(text)
      }
      // Преобразуем bastyon:// ссылки в кликабельные ссылки
      return formatBastyonLinks(decoded)
    }
  }
})
