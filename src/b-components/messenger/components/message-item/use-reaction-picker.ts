// Плавающий пикер реакций: состояние открытия, позиционирование относительно
// триггера (в пределах ближайшего скролл-контейнера), закрытие по клику-вне и по
// скроллу, регистрация/снятие слушателей. Владеет template-ref'ами триггера и
// пикера; DOM-узел резолвит через $el (styled-обёртки не отдают нативный узел).
// Вызывать синхронно в setup — watch/onMounted/onUnmounted должны зарегистрироваться.
// См. LARGE_FILE_SPLIT_AUDIT.md.
import { onMounted, onUnmounted, ref, watch, nextTick, type Ref } from 'vue'

type ElementRefValue = { $el?: HTMLElement } | HTMLElement | null

export interface PickerStyle {
  position: string
  top: string
  left: string
  right?: string
  bottom?: string
  zIndex: number
}

export interface UseReactionPickerOptions {
  /** Можно ли реагировать на это сообщение (чужое реальное). */
  canReact: Ref<boolean>
  /** Отправка выбранной реакции (chatId/id знает вызывающий компонент). */
  onReact: (key: string) => void
}

export function useReactionPicker(opts: UseReactionPickerOptions) {
  const showReactionPicker = ref(false)
  const reactionTriggerRef = ref<ElementRefValue>(null)
  const reactionPickerRef = ref<ElementRefValue>(null)
  const pickerStyle = ref<PickerStyle | null>(null)
  let scrollParent: HTMLElement | null = null
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null
  let scrollHandler: (() => void) | null = null

  function getScrollParent(el: HTMLElement | null): HTMLElement | null {
    if (!el) return null
    let parent = el.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      const overflow = style.overflow + style.overflowY + style.overflowX
      if (/(auto|scroll|overlay)/.test(overflow)) return parent
      parent = parent.parentElement
    }
    return null
  }

  function asElement(refVal: unknown): HTMLElement | null {
    if (!refVal) return null
    const el = (refVal as { $el?: HTMLElement })?.$el ?? refVal
    return el instanceof HTMLElement ? el : null
  }

  function positionPicker(): void {
    const trigger = asElement(reactionTriggerRef.value)
    const picker = asElement(reactionPickerRef.value)
    if (!trigger || !picker) return
    const container = getScrollParent(trigger) || document.documentElement
    const containerRect = container.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    const pickerRect = picker.getBoundingClientRect()
    const gap = 4
    const padding = 8
    const pickerHeight = pickerRect.height || 44
    const pickerWidth = pickerRect.width || 220
    let top: number
    if (triggerRect.top - containerRect.top >= pickerHeight + gap) {
      top = triggerRect.top - pickerHeight - gap
    } else if (containerRect.bottom - triggerRect.bottom >= pickerHeight + gap) {
      top = triggerRect.bottom + gap
    } else {
      top = Math.max(containerRect.top + padding, containerRect.bottom - pickerHeight - padding)
    }
    let left = triggerRect.left
    if (left + pickerWidth > containerRect.right - padding) {
      left = containerRect.right - pickerWidth - padding
    }
    if (left < containerRect.left + padding) {
      left = containerRect.left + padding
    }
    pickerStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      right: 'auto',
      bottom: 'auto',
      zIndex: 10000,
    }
  }

  function toggleReactionPicker(): void {
    if (!opts.canReact.value) return
    showReactionPicker.value = !showReactionPicker.value
    if (showReactionPicker.value) {
      nextTick(() => {
        nextTick(positionPicker)
      })
    } else {
      pickerStyle.value = null
    }
  }

  function onReactionClick(key: string): void {
    if (!opts.canReact.value) return
    opts.onReact(key)
    showReactionPicker.value = false
    pickerStyle.value = null
  }

  watch(showReactionPicker, (open) => {
    if (open) {
      nextTick(() => {
        nextTick(positionPicker)
      })
      clickOutsideHandler = (e: MouseEvent) => {
        const pickerEl = asElement(reactionPickerRef.value)
        const triggerEl = asElement(reactionTriggerRef.value)
        const target = e.target as Node
        if (pickerEl?.contains(target) || triggerEl?.contains(target)) return
        showReactionPicker.value = false
        pickerStyle.value = null
      }
      scrollParent = reactionTriggerRef.value
        ? getScrollParent(asElement(reactionTriggerRef.value))
        : null
      scrollHandler = () => {
        showReactionPicker.value = false
        pickerStyle.value = null
      }
      setTimeout(() => document.addEventListener('click', clickOutsideHandler!, true), 0)
      scrollParent?.addEventListener('scroll', scrollHandler, true)
    } else {
      if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler, true)
      if (scrollHandler) scrollParent?.removeEventListener('scroll', scrollHandler, true)
      clickOutsideHandler = null
      scrollHandler = null
    }
  })

  onMounted(() => {
    if (showReactionPicker.value) nextTick(positionPicker)
  })

  onUnmounted(() => {
    if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler, true)
    if (scrollHandler) scrollParent?.removeEventListener('scroll', scrollHandler, true)
  })

  return {
    showReactionPicker,
    reactionTriggerRef,
    reactionPickerRef,
    pickerStyle,
    toggleReactionPicker,
    onReactionClick,
  }
}
