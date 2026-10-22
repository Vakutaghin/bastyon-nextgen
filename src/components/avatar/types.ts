import type { UserMark } from '@/helpers/profile/user-mark'
import type { VNodeChild } from 'vue'

export interface AvatarProps {
  size?: number | 'large' | 'small' | 'default'
  shape?: 'circle' | 'square'
  src?: string
  alt?: string
  icon?: VNodeChild
  fallbackText?: string // Текст для фолбэка (например, "Иван Петров")
  verified?: boolean
  /** Значок у аватара: проверенный, модератор, «акула» (helpers/profile/user-mark). */
  mark?: UserMark | null
  pending?: boolean // Регистрация в процессе — показывает значок часов
}
