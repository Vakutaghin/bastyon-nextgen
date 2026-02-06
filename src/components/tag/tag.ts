import { computed } from 'vue'
import { Tag } from 'ant-design-vue'
import { SC_Tag } from './styled'
import type { TagProps } from './types'

export function useTag(_p: TagProps) {
  const tagClass = computed(() => {
    return {}
  })

  return {
    Tag,
    SC_Tag,
    tagClass
  }
}
