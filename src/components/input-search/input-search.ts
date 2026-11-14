import { computed, ref } from 'vue'
import type { InputSearchEmits, InputSearchProps } from './types'

/**
 * Поиск как antd Input.Search: Enter и кнопка шлют search с текстом поля,
 * крестик — search с пустой строкой (страницы по нему сбрасывают выдачу).
 * Пока идёт поиск (loading), повторный не запускается.
 */
export function useInputSearch(p: InputSearchProps, emit: InputSearchEmits) {
  const own = ref(p.value ?? '')
  const current = computed<string>(() => p.value ?? own.value)

  function onValue(value: string): void {
    own.value = value
    emit('update:value', value)
  }

  function search(): void {
    if (p.disabled || p.loading) return
    emit('search', current.value)
  }

  function onClear(): void {
    emit('search', '')
    emit('clear')
  }

  // Нажатие на кнопку не уводит фокус из поля, если он там был.
  function keepFocus(e: MouseEvent): void {
    const root = (e.currentTarget as HTMLElement | null)?.parentElement
    if (root?.contains(document.activeElement)) e.preventDefault()
  }

  return { current, onValue, search, onClear, keepFocus }
}
