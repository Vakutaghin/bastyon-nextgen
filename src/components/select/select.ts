import { computed } from 'vue'
import { Select } from 'ant-design-vue'
import { SC_Select } from './styled'
import { definedProps } from '../forward-props'
import type { SelectProps } from './types'

/** Класс выпадающего списка: он рисуется вне обёртки, стили — в style.css. */
export const SELECT_POPUP_CLASS = 'ui-select-dropdown'

/**
 * Куда рисовать список. Внутри модалки — в её обёртку: у модалок z-index 2700
 * и выше, а список antd в body живёт на 1050 и открывался бы под окном.
 */
export function selectPopupContainer(trigger: HTMLElement): HTMLElement {
  return trigger.closest<HTMLElement>('.ant-modal-wrap') ?? document.body
}

export function useSelect(p: SelectProps) {
  // Объявленные пропсы — в antd (см. forward-props.ts); размер по умолчанию —
  // large, как у полей ввода в формах.
  const forwarded = computed<Record<string, unknown>>(() => ({
    ...definedProps(p),
    size: p.size ?? 'large',
  }))

  return { Select, SC_Select, forwarded }
}
