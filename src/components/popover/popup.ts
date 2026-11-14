import { computed, nextTick, onScopeDispose, ref, useId, watch, type Ref } from 'vue'
import type { DismissReason } from '@/components/ui-core/layer-stack'
import type { UiPlacement } from '@/components/ui-core/floating'
import { useFloatingPanel } from '@/components/ui-core/use-floating-panel'
import { tabbables } from '@/components/ui-core/focus-trap'
import { isKeyboardClick } from '@/helpers/a11y/key-activate'
import type { PopupEmits, PopupProps, PopupTrigger } from './types'

/** antd: 0,1 с до показа по наведению и столько же до скрытия. */
const ENTER_DELAY = 0.1
const LEAVE_DELAY = 0.1
/** Сколько кадров ждать, пока floating-ui поставит панель (до этого она скрыта). */
const FOCUS_FRAMES = 10

export interface PopupOptions {
  kind: 'popover' | 'dropdown'
  defaultPlacement: UiPlacement
  /** Зазор до кнопки, px. */
  offset: number
  /** Что получает фокус, когда панель открыли с клавиатуры. */
  focusTarget?: (panel: HTMLElement) => HTMLElement | null
}

/**
 * Кнопка и панель у неё — общее у Popover и Dropdown.
 *
 * - Нажатие открывает и закрывает; с `hover` панель открывает и курсор, а
 *   нажатие её закрепляет (уход курсора не закрывает).
 * - Нажатие мимо закрывает маска `popup-click-shield` (слой — всплывающая
 *   панель в стеке), Esc и «Назад» — стек; после Esc фокус — на кнопку.
 * - Открыли с клавиатуры — фокус в панель; закрылась, пока фокус был в ней, —
 *   фокус на кнопку, а не в никуда.
 */
export function usePopup(
  p: PopupProps,
  emit: PopupEmits,
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  options: PopupOptions
) {
  const id = useId()
  const triggers = computed<Set<PopupTrigger>>(() => {
    const list = p.trigger ?? 'click'
    return new Set(Array.isArray(list) ? list : [list])
  })
  const has = (t: PopupTrigger): boolean => triggers.value.has(t)

  const own = ref(false)
  const isOpen = computed<boolean>(() => p.open ?? own.value)
  /** Открыта нажатием при `hover` — уход курсора её не закрывает. */
  let pinned = false
  let focusOnOpen = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function later(fn: () => void, seconds: number): void {
    clearTimer()
    timer = setTimeout(fn, seconds * 1000)
  }

  function setOpen(value: boolean): void {
    clearTimer()
    if (!value) pinned = false
    if (isOpen.value === value) return
    own.value = value
    emit('update:open', value)
    emit('openChange', value)
  }

  function onDismiss(reason: DismissReason): void {
    setOpen(false)
    if (reason === 'escape') trigger.value?.focus({ preventScroll: true })
  }

  const triggerHandlers = {
    onClick(e: MouseEvent): void {
      if (!has('click')) return
      if (isOpen.value) {
        // Открыта наведением — нажатие закрепляет, второе закрывает.
        if (has('hover') && !pinned) pinned = true
        else setOpen(false)
        return
      }
      pinned = has('hover')
      focusOnOpen = isKeyboardClick(e)
      setOpen(true)
    },
    onPointerenter(e: PointerEvent): void {
      if (e.pointerType !== 'mouse' || !has('hover')) return
      if (isOpen.value) clearTimer()
      else later(() => setOpen(true), p.mouseEnterDelay ?? ENTER_DELAY)
    },
    onPointerleave(e: PointerEvent): void {
      if (e.pointerType !== 'mouse' || !has('hover') || pinned) return
      later(() => setOpen(false), LEAVE_DELAY)
    },
  }

  const panelHandlers = {
    onPointerenter(e: PointerEvent): void {
      if (e.pointerType === 'mouse') clearTimer()
    },
    onPointerleave(e: PointerEvent): void {
      if (e.pointerType !== 'mouse' || !has('hover') || pinned) return
      later(() => setOpen(false), LEAVE_DELAY)
    },
  }

  /** Фокус в панель, когда floating-ui её показал (до расчёта она скрыта). */
  function focusPanel(frames = FOCUS_FRAMES): void {
    const el = panel.value
    if (!el) return
    if (el.style.visibility === 'hidden' && frames > 0) {
      requestAnimationFrame(() => focusPanel(frames - 1))
      return
    }
    const target =
      options.focusTarget?.(el) ??
      el.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ??
      tabbables(el)[0] ??
      el
    if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }

  watch(isOpen, (open) => {
    if (open) {
      if (focusOnOpen) void nextTick(() => focusPanel())
      focusOnOpen = false
      return
    }
    const active = document.activeElement
    if (active && panel.value?.contains(active)) trigger.value?.focus({ preventScroll: true })
  })

  useFloatingPanel({
    open: isOpen,
    kind: options.kind,
    trigger: () => trigger.value,
    panel: () => panel.value,
    floating: () => ({
      placement: p.placement ?? options.defaultPlacement,
      offset: options.offset,
    }),
    onDismiss,
    hover: has('hover'),
  })

  onScopeDispose(clearTimer)

  return { id, isOpen, setOpen, triggerHandlers, panelHandlers }
}
