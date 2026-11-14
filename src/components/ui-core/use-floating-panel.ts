import { watch, type Ref } from 'vue'
import type { DismissReason, LayerKind } from './layer-stack'
import { useLayer } from './use-layer'
import { useFloating, type FloatingOptions } from './floating'

export interface FloatingPanelOptions {
  /** Открыта ли панель. */
  open: Ref<boolean>
  kind: LayerKind
  /** Кнопка: от неё считается положение и слой (панель из окна — над окном). */
  trigger: () => HTMLElement | null
  /** Сама панель (в портале). */
  panel: () => HTMLElement | null
  floating: () => FloatingOptions
  /** Esc, «Назад», нажатие мимо — просьба закрыться. */
  onDismiss?: (reason: DismissReason) => void
  /** Панель «по наведению»: маска нажатий для мыши её не держит. */
  hover?: boolean
}

/**
 * Плавающая панель у кнопки: слой в стеке, положение floating-ui и z-index
 * слоя на самой панели (он считается при открытии — над окном, из которого
 * открыли, — поэтому пишется из JS, а не в стилях).
 */
export function useFloatingPanel(options: FloatingPanelOptions) {
  const { layer, zIndex } = useLayer(options.open, {
    kind: options.kind,
    el: options.panel,
    anchor: options.trigger,
    onDismiss: options.onDismiss,
    hover: options.hover,
  })

  useFloating(options.open, options.trigger, options.panel, options.floating)

  watch(
    [options.panel, zIndex],
    ([panel, z]) => {
      if (panel && z) panel.style.zIndex = String(z)
    },
    { immediate: true, flush: 'post' }
  )

  return { layer, zIndex }
}
