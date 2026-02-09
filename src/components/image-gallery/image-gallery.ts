import { defineComponent } from 'vue'
import VueEasyLightbox from 'vue-easy-lightbox'

export default defineComponent({
  name: 'ImageGallery',
  components: {
    VueEasyLightbox
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    images: {
      type: Array,
      required: true
    },
    initialIndex: {
      type: Number,
      default: 0
    }
  },
  emits: ['update:visible', 'hide'],
  data() {
    return {
      index: 0
    }
  },
  watch: {
    visible(newVal: boolean) {
      if (newVal) {
        this.index = this.initialIndex
        this.preventPageZoom()
      } else {
        this.$nextTick(() => {
          this.removeZoomPrevention()
        })
      }
    },
    initialIndex(newVal: number) {
      this.index = newVal
    }
  },
  beforeUnmount() {
    this.removeZoomPrevention()
  },
  methods: {
    handleHide() {
      this.$emit('update:visible', false)
      this.$emit('hide')
    },
    preventPageZoom() {
      this.removeZoomPrevention()

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault()
        }
      }

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
        }
      }

      ;(this as any)._touchStartHandler = handleTouchStart
      ;(this as any)._wheelHandler = handleWheel

      document.addEventListener('touchstart', handleTouchStart, { passive: false })
      document.addEventListener('wheel', handleWheel, { passive: false })
    },
    removeZoomPrevention() {
      const self = this as any
      if (self._touchStartHandler) {
        document.removeEventListener('touchstart', self._touchStartHandler)
        self._touchStartHandler = null
      }
      if (self._wheelHandler) {
        document.removeEventListener('wheel', self._wheelHandler)
        self._wheelHandler = null
      }
    }
  }
})
