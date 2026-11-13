import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue'
import { pushLayer, type Layer, type LayerOptions } from './layer-stack'

/**
 * Слой в стеке, пока `open`. `zIndex` известен до отрисовки: слой
 * открывается синхронно со сменой `open`, раньше рендера.
 */
export function useLayer(open: WatchSource<boolean>, options: LayerOptions) {
  const layer = shallowRef<Layer | null>(null)
  const zIndex = ref(0)

  const close = (): void => {
    layer.value?.close()
    layer.value = null
  }

  watch(
    open,
    (isOpen) => {
      if (isOpen && !layer.value) {
        layer.value = pushLayer(options)
        zIndex.value = layer.value.zIndex
      } else if (!isOpen) {
        close()
      }
    },
    { immediate: true, flush: 'sync' }
  )
  onScopeDispose(close)

  return { layer, zIndex }
}
