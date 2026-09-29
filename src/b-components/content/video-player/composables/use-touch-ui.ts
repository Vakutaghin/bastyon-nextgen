// Composable: плеер под палец или под мышь. По устройству ввода, а не по
// ширине: узкое окно с мышью — это компьютер (панель, наведение, клик —
// пауза), а телефон — касания, как в приложении YouTube.

import { onBeforeUnmount, ref, type Ref } from 'vue'

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

export function useTouchUi(): Ref<boolean> {
  const query =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(TOUCH_QUERY)
      : null
  const touchUi = ref(query?.matches ?? false)
  const update = (event: MediaQueryListEvent): void => {
    touchUi.value = event.matches
  }
  query?.addEventListener?.('change', update)
  onBeforeUnmount(() => query?.removeEventListener?.('change', update))
  return touchUi
}
