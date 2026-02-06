import { defineComponent, type PropType } from 'vue'
import { SC_BlockLink } from './styled'

interface BlockLinkData {
  url?: string
  href?: string
  text?: string
  link?: string
  target?: string
}

interface BlockLinkBlock {
  type: string
  id: string
  data: BlockLinkData
}

export const blockLinkOptions = defineComponent({
  name: 'BlockLink',
  components: {
    SC_BlockLink
  },
  props: {
    block: {
      type: Object as PropType<BlockLinkBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * URL ссылки
     */
    linkUrl(): string {
      return this.block.data.url || this.block.data.href || '#'
    },
    /**
     * Текст ссылки
     */
    linkText(): string {
      return this.block.data.text || this.block.data.link || this.linkUrl
    },
    /**
     * Декодированный текст ссылки
     */
    decodedText(): string {
      try {
        return decodeURIComponent(String(this.linkText))
      } catch {
        return String(this.linkText)
      }
    },
    /**
     * Целевое окно для ссылки
     */
    linkTarget(): string {
      return this.block.data.target || '_blank'
    }
  }
})
