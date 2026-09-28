import { computed } from 'vue'
import { Select } from 'ant-design-vue'
import { SC_Select } from './styled'
import { definedProps } from '../forward-props'
import type { SelectProps } from './types'

/** Класс выпадающего списка: он рисуется вне обёртки, стили — в style.css. */
export const SELECT_POPUP_CLASS = 'ui-select-dropdown'

export function useSelect(p: SelectProps) {
  // Объявленные пропсы — в antd (см. forward-props.ts); размер по умолчанию —
  // large, как у полей ввода в формах.
  const forwarded = computed<Record<string, unknown>>(() => ({
    ...definedProps(p),
    size: p.size ?? 'large',
  }))

  return { Select, SC_Select, forwarded }
}
