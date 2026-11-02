import { ref, computed, watch, useAttrs } from 'vue'
import { Avatar } from 'ant-design-vue'

import { avatarFallbackBackground, avatarFallbackText, avatarHue } from './color-utils'
import { SC_Avatar } from './styled'
import type { AvatarProps } from './types'
import { getInitials as getInitialsUtil } from '@/helpers/common/initials'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { useTorMedia } from '@/composables/use-tor-media'
import { torMediaUrl } from '@/helpers/tor/tor-media-proxy'

export function useAvatar(p: AvatarProps) {
  // Получаем attrs для проверки header avatar
  const attrs = useAttrs()
  // Под Tor на компьютере окно картинки само не грузит (CSP, V21) — аватар
  // идёт через свою схему, которую Rust отдаёт через Tor (tor-media-proxy).
  const { mediaBlocked } = useTorMedia()

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
    return p.shape === 'square' ? 'var(--ui-radius-sm)' : '50%'
  })

  const getInitials = (): string => {
    const text = p.fallbackText || p.alt
    return getInitialsUtil(text, { fallback: '' })
  }

  /** Оттенок пользователя: имя или адрес дают один и тот же цвет. */
  const hue = computed(() => avatarHue(p.fallbackText || p.alt || p.src || undefined))

  /** Подложка и инициалы аватара без фото (см. color-utils.ts). */
  const fallbackColor = computed(() => avatarFallbackBackground(hue.value))
  const textColor = computed(() => avatarFallbackText(hue.value))

  const handleImageError = (_e: Event) => {
    showPlaceholder.value = true
  }

  const handleImageLoad = () => {
    showPlaceholder.value = false
  }

  // Обновляем фактический src сразу
  watch(
    [() => p.src, mediaBlocked],
    ([newSrc, blocked], [oldSrc, wasBlocked]) => {
      if (!newSrc) {
        actualSrc.value = undefined
        showPlaceholder.value = true
      } else if (newSrc !== oldSrc || blocked !== wasBlocked || !actualSrc.value) {
        showPlaceholder.value = false
        // resolveImageUrl: разворачивает голый хеш в полный URL + нормализует домен
        // (раньше тут был только swap домена — голый хеш оставался сломанным src).
        const url = resolveImageUrl(newSrc)
        actualSrc.value = url && blocked ? torMediaUrl(url) : url
      }
    },
    { immediate: true }
  )

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
    rootEl,
  }
}
