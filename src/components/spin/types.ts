export interface SpinProps {
  /** Размер значка по умолчанию: 14 / 20 / 32px. Свой значок (#indicator) задаёт размер сам. */
  size?: 'small' | 'default' | 'large'
  /** Подпись под значком; её же слышит экранный диктор. */
  tip?: string
}
