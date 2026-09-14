import { computed } from 'vue'
import { Input } from 'ant-design-vue'
import { SC_Input } from './styled'
import { definedProps } from '../forward-props'
import type { InputProps } from './types'

export function useInput(p: InputProps) {
  const inputClass = computed(() => {
    return {}
  })

  // Объявленные пропсы (type/placeholder/disabled/allowClear/…) в antd — см. forward-props.ts.
  const forwarded = computed<Record<string, unknown>>(() => definedProps(p))

  return {
    Input,
    SC_Input,
    inputClass,
    forwarded,
  }
}
