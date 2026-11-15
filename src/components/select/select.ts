/**
 * Поле выбора по WAI-ARIA APG «select-only combobox»: фокус всё время на
 * поле (role=combobox), подсвеченный пункт списка — `aria-activedescendant`.
 *
 * Клавиши: стрелки по кругу, Home / End, первые буквы подписи, Enter и пробел
 * выбирают, Esc и Tab закрывают без выбора. Мышью список открывается по
 * нажатию (mousedown), как у antd: нажатие по подписи <label> поле только
 * фокусирует, как у системного <select>.
 */

import { computed, nextTick, ref, useId, watch, type Ref } from 'vue'
import { useFloatingPanel } from '@/components/ui-core/use-floating-panel'
import type { SelectEmits, SelectOption, SelectProps, SelectValue } from './types'

/** Сколько ждать следующую букву, чтобы искать по началу слова, а не по одной. */
const TYPEAHEAD_MS = 500

/** Зазор между полем и списком, px (как у antd). */
const PANEL_OFFSET = 3

export function useSelect(
  p: SelectProps,
  emit: SelectEmits,
  triggerRef: Ref<HTMLElement | null>,
  panelRef: Ref<HTMLElement | null>
) {
  const trigger = (): HTMLElement | null => triggerRef.value
  const panel = (): HTMLElement | null => panelRef.value
  const id = useId()
  const listId = `${id}-list`
  const optionId = (index: number): string => `${id}-option-${index}`

  const isOpen = ref(false)
  const activeIndex = ref(-1)
  /** Подписи списка для экранного диктора — берутся при открытии. */
  const listLabel = ref<string | undefined>()

  const multiple = computed(() => p.mode === 'multiple')

  const selectedValues = computed<SelectValue[]>(() => {
    const value = p.value
    if (value === undefined || value === null) return []
    return Array.isArray(value) ? value : [value]
  })

  const isSelected = (option: SelectOption): boolean => selectedValues.value.includes(option.value)

  const hasValue = computed(() => selectedValues.value.length > 0)

  const display = computed<string>(() => {
    const values = selectedValues.value
    if (multiple.value) {
      if (p.formatValue) return p.formatValue(values)
      return values.map((value) => labelOf(value)).join(', ')
    }
    return values.length ? labelOf(values[0]!) : ''
  })

  function labelOf(value: SelectValue): string {
    return p.options.find((option) => option.value === value)?.label ?? String(value)
  }

  const enabled = (index: number): boolean => {
    const option = p.options[index]
    return !!option && !option.disabled
  }

  /** Первый доступный пункт, начиная с `from`, шагом `step` по кругу. */
  function seek(from: number, step: 1 | -1): number {
    const count = p.options.length
    for (let i = 0; i < count; i++) {
      const index = (((from + step * i) % count) + count) % count
      if (enabled(index)) return index
    }
    return -1
  }

  /** При открытии подсвечен выбранный пункт, иначе первый доступный. */
  function initialIndex(): number {
    const selected = p.options.findIndex((option) => isSelected(option) && !option.disabled)
    return selected >= 0 ? selected : seek(0, 1)
  }

  /** Прокрутить список к подсвеченному пункту — только с клавиатуры и при открытии. */
  let revealPending = false
  function reveal(): void {
    revealPending = true
    void nextTick(() => {
      if (!revealPending) return
      revealPending = false
      const list = panel()?.querySelector<HTMLElement>('[role="listbox"]')
      const item = list?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex.value))}`)
      if (!list || !item) return
      const top = item.offsetTop
      const bottom = top + item.offsetHeight
      if (top < list.scrollTop) list.scrollTop = top
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight
      }
    })
  }

  function setActive(index: number, scroll = true): void {
    activeIndex.value = index
    if (scroll && index >= 0) reveal()
  }

  function computeListLabel(): string | undefined {
    const el = trigger()
    if (!el) return undefined
    const own = el.getAttribute('aria-label')
    if (own) return own
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
    const text = label?.textContent?.trim()
    return text || undefined
  }

  function open(index = initialIndex()): void {
    if (p.disabled) return
    if (!isOpen.value) {
      listLabel.value = computeListLabel()
      isOpen.value = true
    }
    setActive(index)
  }

  function close(): void {
    isOpen.value = false
    activeIndex.value = -1
    revealPending = false
  }

  function choose(index: number): void {
    const option = p.options[index]
    if (!option || option.disabled) return
    if (multiple.value) {
      const values = selectedValues.value
      const next = values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value]
      emit('update:value', next)
      emit('change', next, option)
      setActive(index, false)
      return
    }
    // Тот же пункт — без события, как у antd: значение не поменялось.
    if (!isSelected(option)) {
      emit('update:value', option.value)
      emit('change', option.value, option)
    }
    close()
  }

  // Поиск по первым буквам: набранное подряд — начало подписи; одна и та же
  // буква несколько раз — по кругу среди пунктов на эту букву.
  let typed = ''
  let typedTimer: ReturnType<typeof setTimeout> | null = null
  function typeahead(char: string): void {
    if (typedTimer) clearTimeout(typedTimer)
    typedTimer = setTimeout(() => (typed = ''), TYPEAHEAD_MS)
    typed += char.toLowerCase()
    const same = [...typed].every((c) => c === typed[0])
    const query = same ? typed[0]! : typed
    const count = p.options.length
    // Новая буква ищет со следующего пункта, продолжение слова — с текущего.
    const start =
      typed.length === 1 || same ? activeIndex.value + 1 : Math.max(activeIndex.value, 0)
    for (let i = 0; i < count; i++) {
      const index = (start + i) % count
      if (enabled(index) && p.options[index]!.label.toLowerCase().startsWith(query)) {
        open(index)
        return
      }
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (p.disabled || e.ctrlKey || e.metaKey) return
    const key = e.key
    const printable = key.length === 1 && !e.altKey && (key !== ' ' || typed !== '')
    if (printable) {
      e.preventDefault()
      typeahead(key)
      return
    }
    if (!isOpen.value) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault()
        open()
      } else if (key === 'Home' || key === 'End') {
        e.preventDefault()
        open(key === 'Home' ? seek(0, 1) : seek(p.options.length - 1, -1))
      }
      return
    }
    switch (key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive(seek(activeIndex.value + 1, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        // Alt+↑ — выбрать и закрыть (APG).
        if (e.altKey && activeIndex.value >= 0 && !multiple.value) choose(activeIndex.value)
        else if (e.altKey) close()
        else setActive(seek(activeIndex.value < 0 ? 0 : activeIndex.value - 1, -1))
        break
      case 'Home':
        e.preventDefault()
        setActive(seek(0, 1))
        break
      case 'End':
        e.preventDefault()
        setActive(seek(p.options.length - 1, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex.value >= 0) choose(activeIndex.value)
        else close()
        break
      case 'Escape':
        // Сами закрываем и гасим: стек слоёв и окно вокруг Esc не берут.
        e.preventDefault()
        close()
        break
      case 'Tab':
        close()
        break
    }
  }

  function focusTrigger(): void {
    const el = trigger()
    if (el && document.activeElement !== el) el.focus({ preventScroll: true })
  }

  function onTriggerMousedown(e: MouseEvent): void {
    if (p.disabled || e.button !== 0) return
    // Фокус ставим сами: Safari не фокусирует кнопку по нажатию.
    e.preventDefault()
    focusTrigger()
    if (isOpen.value) close()
    else open()
  }

  /** Нажатие подписи <label> доходит до поля щелчком — только фокус. */
  function onTriggerClick(): void {
    if (!p.disabled) focusTrigger()
  }

  /** Фокус ушёл с поля (Tab, другое окно) — список закрыть. */
  function onTriggerBlur(e: FocusEvent): void {
    const next = e.relatedTarget
    if (next instanceof Node && panel()?.contains(next)) return
    close()
  }

  function onOptionMousemove(index: number): void {
    if (enabled(index) && activeIndex.value !== index) setActive(index, false)
  }

  watch(
    () => p.disabled,
    (disabled) => {
      if (disabled) close()
    }
  )

  // Пункты сменились при открытом списке — подсветка не должна указывать в пустоту.
  watch(
    () => p.options,
    () => {
      if (isOpen.value && !enabled(activeIndex.value)) activeIndex.value = initialIndex()
    }
  )

  useFloatingPanel({
    open: isOpen,
    kind: 'select',
    trigger,
    panel,
    floating: () => ({
      placement: 'bottomLeft',
      offset: PANEL_OFFSET,
      matchWidth: p.dropdownMatchSelectWidth === false ? true : 'exact',
    }),
    onDismiss: close,
  })

  const activeId = computed(() =>
    isOpen.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined
  )

  return {
    id,
    listId,
    optionId,
    isOpen,
    activeIndex,
    activeId,
    listLabel,
    multiple,
    hasValue,
    display,
    isSelected,
    choose,
    onKeydown,
    onTriggerMousedown,
    onTriggerClick,
    onTriggerBlur,
    onOptionMousemove,
  }
}
