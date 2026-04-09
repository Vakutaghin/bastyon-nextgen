export interface AvatarProps {
  size?: number | 'large' | 'small' | 'default'
  shape?: 'circle' | 'square'
  src?: string
  alt?: string
  icon?: any
  fallbackText?: string // Текст для фолбэка (например, "Иван Петров")
  verified?: boolean
  pending?: boolean // Регистрация в процессе — показывает значок часов
}
