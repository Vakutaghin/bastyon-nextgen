<template>
  <UiPortal>
    <div ref="root" class="ui-toast-host">
      <SC_ToastList
        v-for="placement in PLACEMENTS"
        :key="placement"
        class="ui-toast-list"
        :data-placement="placement"
      >
        <TransitionGroup name="ui-toast" @before-leave="freezeHeight">
          <Toast v-for="item in byPlacement[placement]" :key="item.key" :item="item" />
        </TransitionGroup>
      </SC_ToastList>
    </div>
  </UiPortal>
</template>

<script setup lang="ts">
// Хост тостов — один на приложение (src.vue). Тосты в слое `toast` стека:
// постоянный уровень над окнами и их масками (N32), Esc их не закрывает.
// Новый тост — в конце списка, как у antd: внизу слева он встаёт под
// предыдущими и поднимает их.
import { computed, ref } from 'vue'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useLayer } from '@/components/ui-core/use-layer'
import { toasts } from './toast-store'
import type { ToastItem, ToastPlacement } from './types'
import Toast from './toast.vue'
import { SC_ToastList } from './styled'

const PLACEMENTS: ToastPlacement[] = ['top', 'bottomLeft']

const root = ref<HTMLElement | null>(null)

const byPlacement = computed(() => {
  const lists: Record<ToastPlacement, ToastItem[]> = { top: [], bottomLeft: [] }
  for (const item of toasts) lists[item.placement].push(item)
  return lists
})

useLayer(() => toasts.length > 0, { kind: 'toast', el: () => root.value })

/** Уходящий тост схлопывается от своей высоты: она нужна CSS числом. */
function freezeHeight(el: Element): void {
  const node = el as HTMLElement
  node.style.setProperty('--ui-toast-height', `${node.offsetHeight}px`)
}
</script>
