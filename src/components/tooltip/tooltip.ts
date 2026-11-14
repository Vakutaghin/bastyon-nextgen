import { computed, onScopeDispose, ref, useId, type Ref } from 'vue'
import { useFloatingPanel } from '@/components/ui-core/use-floating-panel'
import { lastInputWasKeyboard, trackInputModality } from '@/components/ui-core/input-modality'
import type { TooltipProps, TooltipTrigger } from './types'

/** antd: 0,1 с до показа по наведению и 0,1 с до скрытия, когда курсор ушёл. */
const ENTER_DELAY = 0.1
const LEAVE_DELAY = 0.1
/** Зазор до кнопки — как был у antd вместе с местом под его стрелку. */
const OFFSET = 15

/**
 * Подсказка по WAI-ARIA: наведение мышью (касание — нет: на телефоне
 * подсказка не должна выскакивать от каждого нажатия), фокус с клавиатуры,
 * при `trigger: 'click'` — нажатие, которое её закрепляет; повторное нажатие
 * или нажатие мимо — убирает. На саму подсказку можно навести курсор, Esc
 * её закрывает (слой `tooltip` в стеке).
 */
export function useTooltip(
  p: TooltipProps,
  hasContent: () => boolean,
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>
) {
  trackInputModality()
  const id = useId()
  const triggers = computed<Set<TooltipTrigger>>(() => {
    const list = p.trigger ?? ['hover', 'focus']
    return new Set(Array.isArray(list) ? list : [list])
  })
  const has = (t: TooltipTrigger): boolean => triggers.value.has(t)

  const open = ref(false)
  const visible = computed<boolean>(() => open.value && hasContent())
  /** Открыта нажатием — уход курсора и фокуса её не убирают. */
  let pinned = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function onOutside(e: Event): void {
    const target = e.target as Node | null
    if (trigger.value?.contains(target) || panel.value?.contains(target)) return
    hide()
  }

  function setPinned(value: boolean): void {
    if (pinned === value) return
    pinned = value
    if (value) document.addEventListener('pointerdown', onOutside, true)
    else document.removeEventListener('pointerdown', onOutside, true)
  }

  function show(delay = 0): void {
    clearTimer()
    if (delay > 0) timer = setTimeout(() => (open.value = true), delay * 1000)
    else open.value = true
  }

  function hide(delay = 0): void {
    clearTimer()
    const run = (): void => {
      open.value = false
      setPinned(false)
    }
    if (delay > 0) timer = setTimeout(run, delay * 1000)
    else run()
  }

  const triggerHandlers = {
    onPointerenter(e: PointerEvent): void {
      if (e.pointerType !== 'mouse' || !has('hover')) return
      if (open.value) clearTimer()
      else show(p.mouseEnterDelay ?? ENTER_DELAY)
    },
    onPointerleave(e: PointerEvent): void {
      if (e.pointerType !== 'mouse' || !has('hover') || pinned) return
      hide(LEAVE_DELAY)
    },
    onFocus(): void {
      if (has('focus') && lastInputWasKeyboard()) show()
    },
    onBlur(): void {
      if (has('focus') && !pinned) hide()
    },
    onClick(): void {
      if (!has('click')) return
      if (pinned) {
        hide()
        return
      }
      setPinned(true)
      show()
    },
  }

  const panelHandlers = {
    onPointerenter(e: PointerEvent): void {
      if (e.pointerType === 'mouse') clearTimer()
    },
    onPointerleave(e: PointerEvent): void {
      if (e.pointerType === 'mouse' && has('hover') && !pinned) hide(LEAVE_DELAY)
    },
  }

  /** Описание кнопки — подсказка, если её текст не совпадает с подписью кнопки. */
  const describedBy = computed<string | undefined>(() => {
    if (!visible.value) return undefined
    return trigger.value?.getAttribute('aria-label') === p.title ? undefined : id
  })

  useFloatingPanel({
    open: visible,
    kind: 'tooltip',
    trigger: () => trigger.value,
    panel: () => panel.value,
    floating: () => ({ placement: p.placement ?? 'top', offset: OFFSET }),
    onDismiss: () => hide(),
  })

  onScopeDispose(() => {
    clearTimer()
    setPinned(false)
  })

  return { id, visible, describedBy, triggerHandlers, panelHandlers, hide }
}
