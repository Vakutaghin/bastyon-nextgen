import { computed } from 'vue'
import { Spin } from 'ant-design-vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { SC_Spin } from './styled'
import { definedProps } from '../forward-props'
import type { SpinProps } from './types'

export function useSpin(p: SpinProps) {
  const spinClass = computed(() => {
    return {}
  })

  // Объявленные пропсы в antd — см. forward-props.ts.
  const forwarded = computed<Record<string, unknown>>(() => definedProps(p))

  return {
    forwarded,
    Spin,
    LoadingOutlined,
    SC_Spin,
    spinClass,
  }
}
