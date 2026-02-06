import { defineComponent, type PropType } from 'vue'
import BlockHeader from './blocks/block-header/block-header.vue'
import BlockParagraph from './blocks/block-paragraph/block-paragraph.vue'
import BlockList from './blocks/block-list/block-list.vue'
import BlockQuote from './blocks/block-quote/block-quote.vue'
import BlockCode from './blocks/block-code/block-code.vue'
import BlockImage from './blocks/block-image/block-image.vue'
import BlockLink from './blocks/block-link/block-link.vue'
import BlockTable from './blocks/block-table/block-table.vue'
import { SC_BlockContent } from './styled'

/**
 * Типы блоков контента
 */
export interface BlockContentBlock {
  /** Тип блока (header, paragraph, list, quote, code, image, link, table) */
  type: string
  /** Уникальный ID блока */
  id: string
  /** Данные блока */
  data: Record<string, unknown>
}

export const blockContentOptions = defineComponent({
  name: 'BlockContent',
  components: {
    BlockHeader,
    BlockParagraph,
    BlockList,
    BlockQuote,
    BlockCode,
    BlockImage,
    BlockLink,
    BlockTable,
    SC_BlockContent
  },
  props: {
    /** JSON строка или объект с блоками контента */
    content: {
      type: [String, Object] as PropType<string | object | null>,
      default: null
    }
  },
  computed: {
    /**
     * Парсит контент и возвращает массив блоков
     */
    parsedBlocks(): BlockContentBlock[] {
      if (!this.content) {
        return []
      }

      try {
        // Если content - это строка, парсим её
        const parsed = typeof this.content === 'string'
          ? JSON.parse(this.content)
          : this.content

        // Проверяем, есть ли поле blocks
        if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) {
          return parsed.blocks as BlockContentBlock[]
        }

        // Если это уже массив блоков
        if (Array.isArray(parsed)) {
          return parsed as BlockContentBlock[]
        }

        return []
      } catch {
        return []
      }
    }
  },
  methods: {
    /**
     * Возвращает компонент для рендеринга блока по его типу
     */
    getBlockComponent(type: string): string {
      const componentMap: Record<string, string> = {
        header: 'BlockHeader',
        paragraph: 'BlockParagraph',
        list: 'BlockList',
        quote: 'BlockQuote',
        code: 'BlockCode',
        image: 'BlockImage',
        link: 'BlockLink',
        table: 'BlockTable'
      }

      return componentMap[type] || 'BlockParagraph'
    }
  }
})
