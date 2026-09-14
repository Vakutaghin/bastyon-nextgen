import { computed } from 'vue'
import { Card } from 'ant-design-vue'
import { SC_Card } from './styled'
import { definedProps } from '../forward-props'
import type { CardProps } from './types'

export function useCard(p: CardProps) {
  const cardClass = computed(() => {
    return {}
  })

  // Объявленные пропсы в antd — см. forward-props.ts.
  const forwarded = computed<Record<string, unknown>>(() => definedProps(p))

  return {
    forwarded,
    Card,
    SC_Card,
    cardClass,
  }
}
