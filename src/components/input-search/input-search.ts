import { computed, h } from 'vue'
import { Input } from 'ant-design-vue'
import { KeyOutlined } from '@ant-design/icons-vue'
import { SC_InputSearch } from './styled'
import { definedProps } from '../forward-props'
import type { InputSearchProps } from './types'

export function useInputSearch(p: InputSearchProps) {
  const searchClass = computed(() => {
    return {}
  })

  // Создаем enterButton с иконкой ключа, если не передан явно
  const enterButtonValue = computed(() => {
    if (p.enterButton !== undefined) {
      return p.enterButton
    }
    // Возвращаем компонент иконки ключа
    return h(KeyOutlined)
  })

  // Объявленные пропсы (onSearch/value/placeholder/allowClear/maxLength/…) в
  // antd — см. forward-props.ts; enterButton собирается отдельно выше.
  const forwarded = computed<Record<string, unknown>>(() => definedProps(p, ['enterButton']))

  return {
    Input,
    KeyOutlined,
    SC_InputSearch,
    searchClass,
    enterButtonValue,
    forwarded,
  }
}
