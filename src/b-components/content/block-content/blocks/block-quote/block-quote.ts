import { defineComponent, type PropType } from 'vue'
import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { SC_BlockQuote, SC_BlockQuoteContent, SC_BlockQuoteCaption } from './styled'

interface BlockQuoteData {
  text?: string
  quote?: string
  caption?: string
  captionText?: string
}

interface BlockQuoteBlock {
  type: string
  id: string
  data: BlockQuoteData
}

export const blockQuoteOptions = defineComponent({
  name: 'BlockQuote',
  components: {
    SC_BlockQuote,
    SC_BlockQuoteContent,
    SC_BlockQuoteCaption
  },
  props: {
    block: {
      type: Object as PropType<BlockQuoteBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Текст цитаты
     */
    text(): string {
      return this.block.data.text || this.block.data.quote || ''
    },
    /**
     * Подпись к цитате
     */
    caption(): string {
      return this.block.data.caption || this.block.data.captionText || ''
    },
    /**
     * Декодированный текст цитаты
     */
    decodedCaption(): string {
      try {
        return decodeURIComponent(String(this.caption))
      } catch {
        return String(this.caption)
      }
    },
    /**
     * Отформатированный текст цитаты с bastyon:// ссылками
     */
    formattedText(): string {
      let decoded = ''
      try {
        decoded = decodeURIComponent(String(this.text))
      } catch {
        decoded = String(this.text)
      }
      let formatted = decoded.replace(/\n/g, '<br>')
      // Преобразуем bastyon:// ссылки в кликабельные ссылки
      formatted = formatBastyonLinks(formatted)
      return formatted
    }
  }
})
