import { ref, computed, type Ref } from 'vue'
import { BREAKPOINT_VALUES } from '@/styles/design-tokens'

/**
 * Reactive viewport observer — следит за размером окна и предоставляет
 * флаги isMobile/isTablet/isDesktop по тем же брейкпоинтам, что и CSS-media.
 *
 * Используй для логики, которая зависит от ширины экрана (показать/скрыть
 * компонент, переключить layout, открыть full-screen modal вместо widget).
 * Для чисто визуальной адаптации (paddings, font-size) используй CSS media.
 *
 * NOTE: в отличие от @mobile/utils/platform isMobile() — этот хук
 * НЕ привязан к Capacitor. Он смотрит размеры экрана и окна, поэтому
 * корректно работает и в браузере, и в native-обёртке.
 *
 * Каркас (`shell`) — на `<html data-shell>` для CSS (SHELL в design-tokens):
 * - `desktop` — шапка с поиском и боковые панели;
 * - `compact` — узкое окно: меню в шапке и нижняя панель разделов;
 * - `rail` — телефон боком: каркас телефона, но разделы — колонкой слева,
 *   потому что высоты мало, а ширины хватает. Такой телефон бывает и шире
 *   768 px, поэтому одной ширины для решения мало.
 */

export type Shell = 'desktop' | 'compact' | 'rail'

type ViewportState = {
  width: Ref<number>
  height: Ref<number>
  isSmallMobile: Ref<boolean>
  isMobile: Ref<boolean>
  isTablet: Ref<boolean>
  isDesktop: Ref<boolean>
  /** Каркас телефона — `compact` или `rail`. */
  isMobileOrTablet: Ref<boolean>
  isPhoneLandscape: Ref<boolean>
  shell: Ref<Shell>
}

/** Короткая сторона экрана у телефона меньше 600 px, у планшета — от 600 (как в Material). */
export const PHONE_SHORT_SIDE = 600

function screenIsLandscape(): boolean {
  const type = screen.orientation?.type
  if (type) return type.startsWith('landscape')
  // iOS до 16.4: screen.orientation нет, есть устаревший window.orientation.
  const legacy = (window as Window & { orientation?: number }).orientation
  if (typeof legacy === 'number') return Math.abs(legacy) === 90
  return window.innerWidth > window.innerHeight
}

/**
 * Телефон боком. Телефон ли это — по короткой стороне экрана, а не окна:
 * клавиатура сжимает окно, и планшет с ней не должен становиться телефоном.
 * Положение — по экрану: у телефона стоя окно с клавиатурой бывает шире,
 * чем выше.
 */
export function isPhoneLandscape(): boolean {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false
  const shortSide = Math.min(screen.width, screen.height)
  if (!shortSide || shortSide >= PHONE_SHORT_SIDE) return false
  return screenIsLandscape() && window.innerWidth > window.innerHeight
}

export function shellFor(width: number, phoneLandscape: boolean): Shell {
  if (phoneLandscape) return 'rail'
  return width <= BREAKPOINT_VALUES.TABLET ? 'compact' : 'desktop'
}

let sharedState: ViewportState | null = null

export function useViewport(): ViewportState {
  if (sharedState) return sharedState

  const hasWindow = typeof window !== 'undefined'
  const width = ref(hasWindow ? window.innerWidth : BREAKPOINT_VALUES.DESKTOP)
  const height = ref(hasWindow ? window.innerHeight : 800)
  const phoneLandscape = ref(isPhoneLandscape())
  const shell = computed<Shell>(() => shellFor(width.value, phoneLandscape.value))

  const applyShell = () => {
    if (typeof document !== 'undefined') document.documentElement.dataset.shell = shell.value
  }

  const update = () => {
    width.value = window.innerWidth
    height.value = window.innerHeight
    phoneLandscape.value = isPhoneLandscape()
    applyShell()
  }

  if (hasWindow) {
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
  }
  applyShell()

  const state: ViewportState = {
    width,
    height,
    isSmallMobile: computed(() => width.value <= BREAKPOINT_VALUES.SMALL_MOBILE),
    isMobile: computed(() => width.value <= BREAKPOINT_VALUES.MOBILE),
    isTablet: computed(() => width.value <= BREAKPOINT_VALUES.TABLET),
    isDesktop: computed(() => width.value > BREAKPOINT_VALUES.TABLET),
    isMobileOrTablet: computed(() => shell.value !== 'desktop'),
    isPhoneLandscape: phoneLandscape,
    shell,
  }

  sharedState = state
  return state
}
