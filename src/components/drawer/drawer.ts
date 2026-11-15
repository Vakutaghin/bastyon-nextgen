import { computed, ref, useId, watch, type Ref } from 'vue'
import { useLayer } from '@/components/ui-core/use-layer'
import { useFocusTrap } from '@/components/ui-core/focus-trap'
import { useScrollLock } from '@/components/ui-core/scroll-lock'
import type { DrawerEmits, DrawerProps } from './types'

/**
 * Шторка сбоку или снизу — на том же ядре, что окна: слой в стеке (из окна —
 * выше окна), Esc, «Назад» и нажатие по маске закрывают, фокус пойман в
 * шторке, страница под ней не прокручивается. Содержимое остаётся после
 * закрытия, как у antd.
 */
export function useDrawer(
  p: DrawerProps,
  emit: DrawerEmits,
  root: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>
) {
  const id = useId()
  const isOpen = computed<boolean>(() => Boolean(p.open))
  const everOpened = ref(isOpen.value)
  watch(isOpen, (open) => {
    if (open) everOpened.value = true
  })

  function close(): void {
    emit('update:open', false)
    emit('close')
  }

  const { zIndex } = useLayer(isOpen, {
    kind: 'drawer',
    el: () => panel.value,
    onDismiss: (reason) => {
      if (reason !== 'outside') close()
    },
  })
  useFocusTrap(isOpen, () => panel.value)
  useScrollLock(isOpen)

  watch(
    [root, zIndex],
    ([el, z]) => {
      if (el && z) el.style.zIndex = String(z)
    },
    { immediate: true, flush: 'post' }
  )

  // Размер — из пропа: ширина у боковой, высота у нижней.
  const size = computed<string>(() => {
    const value = p.placement === 'bottom' ? (p.height ?? 378) : (p.width ?? 378)
    return typeof value === 'number' ? `${value}px` : value
  })
  watch(
    [panel, size, () => p.placement],
    ([el, value, placement]) => {
      if (!el) return
      el.style.width = placement === 'bottom' ? '' : value
      el.style.height = placement === 'bottom' ? value : ''
    },
    { immediate: true, flush: 'post' }
  )

  function onMaskClick(): void {
    if (p.maskClosable !== false) close()
  }

  return { id, isOpen, everOpened, close, onMaskClick }
}
