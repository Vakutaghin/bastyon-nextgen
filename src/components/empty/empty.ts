import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { SC_Empty } from './styled'
import type { EmptyProps } from './types'

export function useEmpty(_p: EmptyProps) {
  const emptyClass = computed(() => {
    return {}
  })

  return {
    Empty,
    SC_Empty,
    emptyClass
  }
}
