import { defineComponent, type PropType } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockParagraph } from './styled'

interface BlockParagraphData {
  text?: string
}

interface BlockParagraphBlock {
  type: string
  id: string
  data: BlockParagraphData
}

export const blockParagraphOptions = defineComponent({
  name: 'BlockParagraph',
  components: {
    SC_BlockParagraph
  },
  props: {
    block: {
      type: Object as PropType<BlockParagraphBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Декодированный и отформатированный текст параграфа
     */
    formattedText(): string {
      const text = this.block.data.text || ''
      let decoded = ''

      try {
        // Декодируем URL-encoded строку
        decoded = decodeURIComponent(String(text))
      } catch {
        decoded = String(text)
      }

      // Заменяем переносы строк на <br>
      let formatted = decoded
        .replace(/\n/g, '<br>')
        .replace(/\r\n/g, '<br>')

      // Преобразуем bastyon:// ссылки в кликабельные ссылки
      formatted = formatBastyonLinks(formatted)

      return formatted
    }
  }
})
