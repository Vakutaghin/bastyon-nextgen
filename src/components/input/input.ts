import { computed } from 'vue'
import { Input } from 'ant-design-vue'
import { SC_Input } from './styled'
import type { InputProps } from './types'

export function useInput(_p: InputProps) {
  const inputClass = computed(() => {
    return {}
  })

  return {
    Input,
    SC_Input,
    inputClass
  }
}
