import { computed } from 'vue'
import { Card } from 'ant-design-vue'
import { SC_Card } from './styled'
import type { CardProps } from './types'

export function useCard(_p: CardProps) {
  const cardClass = computed(() => {
    return {}
  })

  return {
    Card,
    SC_Card,
    cardClass
  }
}
