import { defineComponent, type PropType } from 'vue'
import { ZoomInOutlined } from '@ant-design/icons-vue'
import { useModalStore } from '@/stores/modal-store'
import {
  SC_PostImage,
  SC_ImageWrapper,
  SC_ImageOverlay,
  SC_ZoomIconCircle
} from './styled'

export const postCardImagesOptions = defineComponent({
  name: 'PostCardImages',
  components: {
    ZoomInOutlined,
    SC_PostImage,
    SC_ImageWrapper,
    SC_ImageOverlay,
    SC_ZoomIconCircle
  },
  props: {
    images: {
      type: Array as PropType<string[]>,
      required: true
    }
  },
  setup() {
    const modalStore = useModalStore()
    return { modalStore }
  },
  data() {
    return {
      imageAspectRatios: {} as Record<number, { width: number; height: number; useContain: boolean }>
    }
  },
  computed: {
    imageCount(): number {
      return this.images ? this.images.length : 0
    }
  },
  methods: {
    handleImageError(event: Event): void {
      const target = event.target as HTMLImageElement
      if (target) {
        target.style.display = 'none'
      }
    },
    handleImageLoad(event: Event, imageIndex: number): void {
      const target = event.target as HTMLImageElement
      if (!target) return

      const naturalWidth = target.naturalWidth
      const naturalHeight = target.naturalHeight

      if (naturalWidth === 0 || naturalHeight === 0) return

      const aspectRatio = naturalWidth / naturalHeight
      const useContain = aspectRatio > (1 / 1.5)

      this.imageAspectRatios[imageIndex] = {
        width: naturalWidth,
        height: naturalHeight,
        useContain
      }

      if (this.imageCount === 1 && naturalHeight > naturalWidth * 2) {
        target.style.aspectRatio = '1 / 2'
        target.style.maxHeight = '500px'
      }
    },
    getImageWrapperStyle(imageIndex: number): Record<string, string> {
      const imageInfo = this.imageAspectRatios[imageIndex]
      if (imageInfo && imageInfo.useContain) {
        return {
          backgroundColor: '#f5f5f5'
        }
      }
      return {}
    },
    getImageStyle(imageIndex: number): Record<string, string> {
      const imageInfo = this.imageAspectRatios[imageIndex]
      if (imageInfo && imageInfo.useContain) {
        return {
          objectFit: 'contain'
        }
      }
      return {
        objectFit: 'cover'
      }
    },
    openImageGallery(index: number): void {
      if (this.images && this.images.length > 0) {
        this.modalStore.openImageGallery(this.images, index)
      }
    }
  }
})
