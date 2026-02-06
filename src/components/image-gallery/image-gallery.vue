<template>
  <VueEasyLightbox
    :visible='visible'
    :imgs='images'
    :index='index'
    @hide='handleHide'
  />
</template>

<script>
import VueEasyLightbox from 'vue-easy-lightbox'

export default {
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
    visible(newVal) {
      if (newVal) {
        this.index = this.initialIndex
        // Предотвращаем зум страницы при открытой галерее
        this.preventPageZoom()
      } else {
        // Убираем обработчики при закрытии
        // Используем nextTick для гарантии, что обработчики удалятся после закрытия
        this.$nextTick(() => {
          this.removeZoomPrevention()
        })
      }
    },
    initialIndex(newVal) {
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
      // Удаляем старые обработчики, если они есть
      this.removeZoomPrevention()

      // Предотвращаем зум страницы при пинче
      // Блокируем только multi-touch (пинч) на всей странице, когда открыта галерея
      const handleTouchStart = (e) => {
        // Если касаний больше одного (пинч), предотвращаем стандартное поведение
        // Это предотвратит зум страницы при пинче на тачпаде
        if (e.touches.length > 1) {
          e.preventDefault()
        }
      }

      const handleWheel = (e) => {
        // Предотвращаем зум страницы колесом мыши с Ctrl/Cmd
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
        }
      }

      // Сохраняем обработчики для последующего удаления
      this._touchStartHandler = handleTouchStart
      this._wheelHandler = handleWheel

      // Добавляем обработчики
      // touchstart блокирует только пинч, не обычный скролл
      document.addEventListener('touchstart', handleTouchStart, { passive: false })
      document.addEventListener('wheel', handleWheel, { passive: false })
    },
    removeZoomPrevention() {
      // Удаляем обработчики
      if (this._touchStartHandler) {
        document.removeEventListener('touchstart', this._touchStartHandler)
        this._touchStartHandler = null
      }
      if (this._wheelHandler) {
        document.removeEventListener('wheel', this._wheelHandler)
        this._wheelHandler = null
      }
    }
  }
}
</script>

<style scoped>
:deep(.vel-modal) {
  background-color: rgba(0, 0, 0, 0.9);
  /* Разрешаем пан и пинч-зум, но не зум страницы */
  touch-action: pan-x pan-y pinch-zoom;
  -ms-touch-action: pan-x pan-y pinch-zoom;
}

:deep(.vel-img) {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  /* Разрешаем пан и пинч-зум на изображении */
  touch-action: pan-x pan-y pinch-zoom;
  -ms-touch-action: pan-x pan-y pinch-zoom;
}

:deep(.vel-close) {
  color: rgba(255, 255, 255, 0.9);
  font-size: 32px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

:deep(.vel-close:hover) {
  opacity: 1;
}

:deep(.vel-btn) {
  color: rgba(255, 255, 255, 0.9);
  opacity: 0.8;
  transition: opacity 0.2s;
}

:deep(.vel-btn:hover) {
  opacity: 1;
}
</style>
