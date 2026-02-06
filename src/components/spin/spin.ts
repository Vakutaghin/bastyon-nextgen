import { computed } from 'vue'
import { Spin } from 'ant-design-vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { SC_Spin } from './styled'
import type { SpinProps } from './types'

export function useSpin(_p: SpinProps) {
  const spinClass = computed(() => {
    return {}
  })

  return {
    Spin,
    LoadingOutlined,
    SC_Spin,
    spinClass,
  }
}
