import { defineComponent, type PropType } from 'vue'
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

export const blockCodeOptions = defineComponent({
  name: 'BlockCode',
  components: {
    SC_BlockCode,
    SC_BlockCodeCode
  },
  props: {
    block: {
      type: Object as PropType<BlockCodeBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  computed: {
    /**
     * Код для отображения
     */
    code(): string {
      return this.block.data.code || this.block.data.text || ''
    },
    /**
     * Декодированный код
     */
    decodedCode(): string {
      try {
        return decodeURIComponent(String(this.code))
      } catch {
        return String(this.code)
      }
    }
  }
})
