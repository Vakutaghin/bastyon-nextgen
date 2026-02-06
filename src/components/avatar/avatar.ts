import { ref, computed, watch, useAttrs } from 'vue'
import { Avatar } from 'ant-design-vue'

import { generateNeutralColor, getContrastTextColor } from './color-utils'
import { SC_Avatar } from './styled'
import type { AvatarProps } from './types'


export function useAvatar(p: AvatarProps) {
  // Получаем attrs для проверки header avatar
  const attrs = useAttrs()

  const showPlaceholder = ref(false)
  const actualSrc = ref<string | undefined>(undefined)
  const rootEl = ref<HTMLElement | null>(null)

  // Проверяем, это header avatar
  const isHeaderAvatar = computed(() => 'data-header-avatar' in attrs)

  const avatarClass = computed(() => {
    return {}
  })

  const sizePx = computed(() => {
    if (typeof p.size === 'number') return p.size
    if (p.size === 'large') return 40
    if (p.size === 'small') return 24
    return 32
  })

  // Вычисляем border-radius в зависимости от shape
  const borderRadius = computed(() => {
    return p.shape === 'square' ? '4px' : '50%'
  })

  /**
   * Извлекает первые буквы из текста
   * Если передан "Иван Петров", вернет "ИП"
   * Если передан "Иван", вернет "И"
   * Если текста нет, вернет пустую строку
   */
  const getInitials = (): string => {
    // Используем fallbackText, если передан, иначе alt
    const text = p.fallbackText || p.alt

    if (!text || typeof text !== 'string') {
      return ''
    }

    // Разбиваем текст на слова и берем первые буквы
    const words = text.trim().split(/\s+/).filter(word => word.length > 0)

    if (words.length === 0) {
      return ''
    }

    if (words.length === 1) {
      // Если одно слово, берем первую букву
      return words[0].charAt(0).toUpperCase()
    }

    // Если несколько слов, берем первые буквы первых двух слов
    const firstLetter = words[0].charAt(0).toUpperCase()
    const secondLetter = words[1] ? words[1].charAt(0).toUpperCase() : ''

    return firstLetter + secondLetter
  }

  /**
   * Генерирует цвет фона для фолбэка
   */
  const fallbackColor = computed(() => {
    // Если есть текст, используем его как seed для детерминированного цвета
    const text = p.fallbackText || p.alt
    const seed = text || p.src || undefined
    return generateNeutralColor(seed)
  })

  /**
   * Генерирует цвет текста для контраста с фоном
   */
  const textColor = computed(() => {
    return getContrastTextColor(fallbackColor.value)
  })

  const handleImageError = (_e: Event) => {
    showPlaceholder.value = true
  }

  const handleImageLoad = () => {
    showPlaceholder.value = false
  }

  // Обновляем фактический src сразу
  watch(() => p.src, (newSrc, oldSrc) => {
    if (newSrc && newSrc !== oldSrc) {
      showPlaceholder.value = false
      const s = newSrc.replace('://bastyon.com:8092/', '://pocketnet.app:8092/')
      actualSrc.value = s
    } else if (!newSrc) {
      actualSrc.value = undefined
      showPlaceholder.value = true
    }
  }, { immediate: true })

  return {
    Avatar,
    SC_Avatar,
    attrs,
    showPlaceholder,
    isHeaderAvatar,
    avatarClass,
    sizePx,
    borderRadius,
    getInitials,
    fallbackColor,
    textColor,
    handleImageError,
    handleImageLoad,
    actualSrc,
    rootEl
  }
}
