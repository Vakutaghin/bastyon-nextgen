// Ядро слоёв для своих окон, панелей, меню и тостов: стек со слоями (z-index,
// Esc, «Назад»), ловушка фокуса, блокировка прокрутки, положение панелей,
// портал. Компоненты собираются из этих частей, а не из antd.
export {
  contextZ,
  dismissPopupLayers,
  isPopupLayer,
  layerContaining,
  openLayers,
  popupLayers,
  pushLayer,
  topLayer,
  type DismissReason,
  type Layer,
  type LayerKind,
  type LayerOptions,
} from './layer-stack'
export { useLayer } from './use-layer'
export { tabbables, trapFocus, useFocusTrap, type FocusTrapOptions } from './focus-trap'
export { SCROLL_LOCK_CLASS, lockScroll, useScrollLock } from './scroll-lock'
export {
  anchorFloating,
  toFloatingPlacement,
  useFloating,
  type FloatingOptions,
  type UiPlacement,
} from './floating'
export { LAYER_ROOT_ID, layerRoot } from './layer-root'
export { default as UiPortal } from './ui-portal.vue'
