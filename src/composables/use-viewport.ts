import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { BREAKPOINT_VALUES } from '@/styles/design-tokens'

/**
 * Reactive viewport observer — следит за window.innerWidth и предоставляет
 * флаги isMobile/isTablet/isDesktop по тем же брейкпоинтам, что и CSS-media.
 *
 * Используй для логики, которая зависит от ширины экрана (показать/скрыть
 * компонент, переключить layout, открыть full-screen modal вместо widget).
 * Для чисто визуальной адаптации (paddings, font-size) используй CSS media.
 *
 * NOTE: в отличие от @mobile/utils/platform isMobile() — этот хук
 * НЕ привязан к Capacitor. Он смотрит ТОЛЬКО ширину viewport, поэтому
 * корректно работает и в браузере, и в native-обёртке.
 */

type ViewportState = {
  width: Ref<number>
  isSmallMobile: Ref<boolean>
  isMobile: Ref<boolean>
  isTablet: Ref<boolean>
  isDesktop: Ref<boolean>
  isMobileOrTablet: Ref<boolean>
}

let sharedState: ViewportState | null = null

export function useViewport(): ViewportState {
  if (sharedState) return sharedState

  const width = ref(typeof window !== 'undefined' ? window.innerWidth : BREAKPOINT_VALUES.DESKTOP)

  const update = () => {
    width.value = window.innerWidth
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
  }

  const state: ViewportState = {
    width,
    isSmallMobile: computed(() => width.value <= BREAKPOINT_VALUES.SMALL_MOBILE),
    isMobile: computed(() => width.value <= BREAKPOINT_VALUES.MOBILE),
    isTablet: computed(() => width.value <= BREAKPOINT_VALUES.TABLET),
    isDesktop: computed(() => width.value > BREAKPOINT_VALUES.TABLET),
    isMobileOrTablet: computed(() => width.value <= BREAKPOINT_VALUES.TABLET),
  }

  sharedState = state
  return state
}
