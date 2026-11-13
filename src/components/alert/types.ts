export type AlertType = 'info' | 'success' | 'warning' | 'error'

export interface AlertProps {
  type?: AlertType
  /** Заголовок; текст под ним — слотом #description (или по умолчанию). */
  title?: string
  showIcon?: boolean
}
