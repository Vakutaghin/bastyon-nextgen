import type { CSSProperties, VNodeChild } from 'vue'

export interface CardProps {
  title?: string
  extra?: VNodeChild
  bordered?: boolean
  hoverable?: boolean
  loading?: boolean
  size?: 'default' | 'small'
  headStyle?: CSSProperties
  bodyStyle?: CSSProperties
}
