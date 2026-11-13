import { computed, ref, watch } from 'vue'
import type { SwitchEmits, SwitchProps } from './types'

/**
 * Состояние переключателя: управляемый (`checked` задан) или свой. Нажатие
 * шлёт update:checked, change и click с новым значением — как antd Switch.
 */
export function useSwitch(p: SwitchProps, emit: SwitchEmits) {
  const own = ref(Boolean(p.checked))
  watch(
    () => p.checked,
    (v) => {
      if (v !== undefined) own.value = v
    }
  )

  const isOn = computed(() => (p.checked === undefined ? own.value : p.checked))
  const blocked = computed(() => Boolean(p.disabled || p.loading))

  const toggle = (event: MouseEvent): void => {
    if (blocked.value) return
    const next = !isOn.value
    if (p.checked === undefined) own.value = next
    emit('update:checked', next)
    emit('change', next, event)
    emit('click', next, event)
  }

  return { isOn, blocked, toggle }
}
