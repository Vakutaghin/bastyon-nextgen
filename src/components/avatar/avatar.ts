import { ref, computed, watch, useAttrs } from 'vue'
import { Avatar } from 'ant-design-vue'

import { avatarFallbackBackground, avatarFallbackText, avatarHue } from './color-utils'
import { SC_Avatar } from './styled'
import type { AvatarProps } from './types'
import { getInitials as getInitialsUtil } from '@/helpers/common/initials'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { useTorMedia } from '@/composables/use-tor-media'
import { torMediaUrl } from '@/helpers/tor/tor-media-proxy'
import { avatarSource, fallbackThumb, rememberThumb } from '@/services/avatar-thumbs'

export function useAvatar(p: AvatarProps) {
  // Получаем attrs для проверки header avatar
  const attrs = useAttrs()
  // Под Tor на компьютере окно картинки само не грузит (CSP, V21) — аватар
  // идёт через свою схему, которую Rust отдаёт через Tor (tor-media-proxy).
  const { mediaBlocked } = useTorMedia()

  const showPlaceholder = ref(false)
  /** Сеть картинку не дала: показываем запасное превью, если оно есть. */
  const networkFailed = ref(false)
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

  // resolveImageUrl: разворачивает голый хеш в полный URL + нормализует домен
  // (раньше тут был только swap домена — голый хеш оставался сломанным src).
  const imageUrl = computed(() => resolveImageUrl(p.src))

  /**
   * Превью с устройства (services/avatar-thumbs): небольшая аватарка берёт его
   * вместо картинки — без сети и без запроса. Пока превью читается, ни
   * картинки, ни инициалов: это миллисекунды.
   */
  const source = computed(() => avatarSource(imageUrl.value, sizePx.value))
  const waiting = computed(() => source.value.wait)

  const actualSrc = computed<string | undefined>(() => {
    const url = imageUrl.value
    if (!url) return undefined
    if (networkFailed.value) return fallbackThumb(url)
    const src = source.value.src
    return src === url && mediaBlocked.value ? torMediaUrl(url) : src
  })

  const handleImageError = (_e: Event) => {
    // Картинка из сети не пришла — попробуем превью (без сети, крупная аватарка).
    if (!actualSrc.value?.startsWith('data:')) networkFailed.value = true
    showPlaceholder.value = true
  }

  const handleImageLoad = (e?: Event) => {
    showPlaceholder.value = false
    rememberThumb(imageUrl.value, e?.target ?? null)
  }

  // Новая картинка или режим Tor — пробуем заново.
  watch([imageUrl, mediaBlocked], () => {
    networkFailed.value = false
    showPlaceholder.value = false
  })
  // Пришло превью (прочиталось с устройства после сбоя сети) — показываем его.
  watch(actualSrc, (src, old) => {
    if (src && src !== old) showPlaceholder.value = false
  })

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
    waiting,
    rootEl,
  }
}
