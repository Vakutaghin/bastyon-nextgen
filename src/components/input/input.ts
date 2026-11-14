import { computed, nextTick, onMounted, ref, useAttrs, type Ref, type StyleValue } from 'vue'
import type { FieldProps, InputEmits, InputExpose, InputProps } from './types'

type FieldElement = HTMLInputElement | HTMLTextAreaElement

/** Enter, который завершает ввод: не подтверждение слова в IME (китайский, корейский). */
export function isEnterKey(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.isComposing && e.keyCode !== 229
}

/** Подпись счётчика: «12 / 120» с пределом, иначе просто число. */
export function countLabel(value: string, max?: number): string {
  return max ? `${value.length} / ${max}` : String(value.length)
}

/**
 * Значение поля, общее для Input и TextArea. С `value` поле управляемое, как у
 * antd: если родитель символ не принял (поправил значение в обработчике или не
 * обновил его), на следующем тике поле возвращается к значению родителя. Без
 * `value` поле помнит набранное само.
 */
export function useFieldValue(
  p: FieldProps,
  onValue: (value: string) => void,
  control: Ref<FieldElement | null>
) {
  const own = ref(p.value ?? '')
  const current = computed<string>(() => p.value ?? own.value)

  function setValue(next: string): void {
    own.value = next
    onValue(next)
    void nextTick(() => {
      const el = control.value
      if (el && p.value !== undefined && el.value !== p.value) el.value = p.value
    })
  }

  const countText = computed<string>(() => countLabel(current.value, p.maxlength))

  // autofocus как у antd — фокус после монтирования: атрибут сам по себе
  // срабатывает только при загрузке страницы, а поля живут в окнах.
  onMounted(() => {
    if (p.autofocus) control.value?.focus()
  })

  const expose: InputExpose = {
    focus: () => control.value?.focus(),
    blur: () => control.value?.blur(),
    select: () => control.value?.select(),
  }

  return { current, setValue, countText, expose }
}

/**
 * Атрибуты потребителя: class и style — на корень поля, остальное (id, aria-*,
 * data-testid, autocomplete, обработчики) — на сам input, как раскладывал antd.
 */
export function useSplitAttrs() {
  const attrs = useAttrs()
  const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style as StyleValue }))
  const controlAttrs = computed(() => {
    const rest: Record<string, unknown> = { ...attrs }
    delete rest.class
    delete rest.style
    return rest
  })
  return { rootAttrs, controlAttrs }
}

export function useInput(p: InputProps, emit: InputEmits, control: Ref<HTMLInputElement | null>) {
  const field = useFieldValue(p, (v) => emit('update:value', v), control)

  const clearable = computed<boolean>(() => Boolean(p.allowClear && !p.disabled && !p.readonly))
  const hasSuffix = computed<boolean>(() => clearable.value || Boolean(p.showCount))

  function onInput(e: Event): void {
    field.setValue((e.target as HTMLInputElement).value)
  }

  function onKeydown(e: KeyboardEvent): void {
    if (isEnterKey(e)) emit('pressEnter', e)
  }

  function clear(): void {
    field.setValue('')
    emit('clear')
    control.value?.focus()
  }

  return { ...field, clearable, hasSuffix, onInput, onKeydown, clear }
}
