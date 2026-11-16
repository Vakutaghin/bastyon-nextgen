<template>
  <component :is="renderTrigger()" />
  <UiPortal>
    <Transition name="ui-pop" @before-leave="markClosed">
      <SC_Dropdown
        v-if="isOpen"
        :id="id"
        :ref="setPanel"
        class="ui-dropdown"
        :class="overlayClass"
        data-state="open"
        @pointerenter="panelHandlers.onPointerenter"
        @pointerleave="panelHandlers.onPointerleave"
      >
        <slot name="overlay" />
      </SC_Dropdown>
    </Transition>
  </UiPortal>
</template>

<script setup lang="ts">
// Выпадающая панель у кнопки вместо antd Dropdown. В панели — Menu (выбор
// пункта её закрывает) или своё содержимое со своей карточкой: сама панель
// прозрачная, как у antd. Своего узла вокруг кнопки нет.
import { Comment, h, provide, useAttrs, useSlots } from 'vue'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef, useTriggerElement } from '@/components/ui-core/trigger'
import { usePopup } from '@/components/popover/popup'
import type { PopupEmits, PopupProps } from '@/components/popover/types'
import { firstMenuItem, MENU_HOST } from '@/components/menu/menu'
import { SC_Dropdown } from './styled'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<PopupProps>(), {
  open: undefined,
  trigger: 'click',
  placement: 'bottomLeft',
  mouseEnterDelay: undefined,
  overlayClass: undefined,
})
const emit = defineEmits<PopupEmits>()
const slots = useSlots()
const attrs = useAttrs()

const trigger = useTriggerElement()
const { el: panelEl, setRef: setPanel } = useElementRef()

const { id, isOpen, setOpen, triggerHandlers, panelHandlers } = usePopup(
  props,
  emit,
  trigger.el,
  panelEl,
  {
    kind: 'dropdown',
    defaultPlacement: 'bottomLeft',
    offset: 4,
    focusTarget: firstMenuItem,
  }
)

provide(MENU_HOST, { close: () => setOpen(false) })

/** Уходящая панель (анимация закрытия) — уже закрытая для стилей и тестов. */
function markClosed(el: Element): void {
  ;(el as HTMLElement).dataset.state = 'closed'
}

function renderTrigger() {
  return (
    trigger.render(slots.default?.(), {
      ...attrs,
      ...triggerHandlers,
      class: ['ui-dropdown-trigger', isOpen.value && 'ui-dropdown-open'],
      'aria-haspopup': 'true',
      'aria-expanded': String(isOpen.value),
      'aria-controls': isOpen.value ? id : undefined,
    }) ?? h(Comment)
  )
}
</script>
