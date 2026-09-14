import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { SC_Empty } from './styled'
import { definedProps } from '../forward-props'
import type { EmptyProps } from './types'

export function useEmpty(p: EmptyProps) {
  const emptyClass = computed(() => {
    return {}
  })

  // Объявленные пропсы в antd — см. forward-props.ts.
  const forwarded = computed<Record<string, unknown>>(() => definedProps(p))

  return {
    forwarded,
    Empty,
    SC_Empty,
    emptyClass,
  }
}
