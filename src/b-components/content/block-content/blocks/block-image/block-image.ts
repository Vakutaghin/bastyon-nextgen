import { defineComponent, type PropType } from 'vue'
import { SC_BlockImage, SC_BlockImageImg, SC_BlockImageCaption } from './styled'

interface BlockImageData {
  url?: string
  src?: string
  caption?: string
  captionText?: string
  alt?: string
  file?: {
    url?: string
  }
}

interface BlockImageBlock {
  type: string
  id: string
  data: BlockImageData
}

export const blockImageOptions = defineComponent({
  name: 'BlockImage',
  components: {
    SC_BlockImage,
    SC_BlockImageImg,
    SC_BlockImageCaption
  },
  props: {
    block: {
      type: Object as PropType<BlockImageBlock>,
      required: true
    },
    index: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      imageError: false
    }
  },
  computed: {
    /**
     * URL изображения
     */
    imageUrl(): string {
      return this.block.data.url || this.block.data.file?.url || this.block.data.src || ''
    },
    /**
     * Альтернативный текст изображения
     */
    imageAlt(): string {
      return this.block.data.caption || this.block.data.alt || ''
    },
    /**
     * Подпись к изображению
     */
    imageCaption(): string {
      return this.block.data.caption || this.block.data.captionText || ''
    },
    /**
     * Декодированная подпись
     */
    decodedCaption(): string {
      try {
        return decodeURIComponent(String(this.imageCaption))
      } catch {
        return String(this.imageCaption)
      }
    }
  },
  methods: {
    handleImageError(): void {
      this.imageError = true
    }
  }
})
