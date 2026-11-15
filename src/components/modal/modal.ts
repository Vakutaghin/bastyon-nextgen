import { computed, ref, useId, watch, type Ref, type Slots } from 'vue'
import { useLayer } from '@/components/ui-core/use-layer'
import { useFocusTrap } from '@/components/ui-core/focus-trap'
import { useScrollLock } from '@/components/ui-core/scroll-lock'
import type { ModalEmits, ModalProps } from './types'

/** Ширина по умолчанию и «во всю ширину» — до колонки ленты. */
const DEFAULT_WIDTH = 520
const FULL_WIDTH = 'min(95vw, 880px)'

/**
 * Окно поверх страницы — своё, без antd.
 *
 * - Слой ставит стек: окно из окна выше, Esc и «Назад» закрывают только
 *   верхнее; фокус пойман в окне и возвращается на место; страница под окном
 *   не прокручивается.
 * - Содержимое создаётся при первом открытии и остаётся (как у antd), с
 *   `destroyOnClose` — снимается после анимации закрытия.
 * - Нажатие по маске закрывает, только если и нажали, и отпустили на ней:
 *   выделение текста, начатое в окне, окно не закрывает.
 */
export interface ModalElements {
  /** Корень окна в портале: на нём слой (z-index). */
  root: Ref<HTMLElement | null>
  /** Само окно (role="dialog"): ширина, ловушка фокуса, слой в стеке. */
  panel: Ref<HTMLElement | null>
}

export function useModal(
  p: ModalProps,
  emit: ModalEmits,
  slots: Slots,
  { root, panel }: ModalElements
) {
  const id = useId()

  const isOpen = computed<boolean>(() => p.open ?? p.modelValue ?? false)

  /** Однажды открыто — содержимое есть в DOM (пока его не сняли). */
  const everOpened = ref(isOpen.value)
  /** Идёт анимация закрытия: обёртка ещё видна. */
  const leaving = ref(false)

  watch(isOpen, (open) => {
    if (open) {
      everOpened.value = true
      leaving.value = false
    } else if (everOpened.value) {
      leaving.value = true
    }
  })

  const rendered = computed<boolean>(
    () => everOpened.value && !(p.destroyOnClose && !isOpen.value && !leaving.value)
  )
  const wrapVisible = computed<boolean>(() => isOpen.value || leaving.value)

  function setOpen(value: boolean): void {
    emit('update:open', value)
    emit('update:modelValue', value)
  }

  function cancel(): void {
    setOpen(false)
    emit('cancel')
  }

  function onAfterLeave(): void {
    leaving.value = false
    if (p.destroyOnClose) everOpened.value = false
    emit('afterClose')
  }

  const { zIndex } = useLayer(isOpen, {
    kind: 'modal',
    el: () => panel.value,
    closeOnEscape: p.keyboard !== false,
    closeOnBack: !p.ignoreBack,
    onDismiss: (reason) => {
      // Нажатие мимо окна — это маска, её обрабатывает само окно.
      if (reason !== 'outside') cancel()
    },
  })

  useFocusTrap(isOpen, () => panel.value)
  useScrollLock(isOpen)

  // Слой и ширина — из JS: слой считается при открытии, ширина — проп.
  watch(
    [root, zIndex],
    ([el, z]) => {
      if (el && z) el.style.zIndex = String(z)
    },
    { immediate: true, flush: 'post' }
  )
  const width = computed<string>(() => {
    if (p.fullWidth) return FULL_WIDTH
    const w = p.width ?? DEFAULT_WIDTH
    return typeof w === 'number' ? `${w}px` : w
  })
  watch(
    [panel, width],
    ([el, w]) => {
      if (el) el.style.width = w
    },
    { immediate: true, flush: 'post' }
  )

  let downOnMask = false
  function onWrapPointerdown(e: PointerEvent): void {
    downOnMask = e.target === e.currentTarget
  }
  function onWrapClick(e: MouseEvent): void {
    const onMask = downOnMask && e.target === e.currentTarget
    downOnMask = false
    if (onMask && p.maskClosable !== false) cancel()
  }

  const hasTitle = computed<boolean>(() => Boolean(p.title || slots.title))
  /** Штатный футер — когда просили кнопку ОК. */
  const defaultFooter = computed<boolean>(() => Boolean(p.okText || p.onOk))
  const hasFooter = computed<boolean>(() => {
    if (p.footer === null) return false
    return p.footer !== undefined || Boolean(slots.footer) || defaultFooter.value
  })

  function onOk(e: MouseEvent): void {
    p.onOk?.(e)
  }

  return {
    id,
    isOpen,
    rendered,
    wrapVisible,
    hasTitle,
    hasFooter,
    defaultFooter,
    cancel,
    onOk,
    onAfterLeave,
    onWrapPointerdown,
    onWrapClick,
  }
}
