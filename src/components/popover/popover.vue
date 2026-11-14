<template>
  <component :is="renderTrigger()" />
  <UiPortal>
    <Transition name="ui-pop" @before-leave="markClosed">
      <SC_Popover
        v-if="isOpen"
        :id="id"
        :ref="setPanel"
        class="ui-popover"
        :class="overlayClass"
        :role="role"
        :aria-labelledby="hasTitle ? `${id}-title` : undefined"
        :aria-label="hasTitle ? undefined : panelLabel"
        data-state="open"
        data-popup-host
        @pointerenter="panelHandlers.onPointerenter"
        @pointerleave="panelHandlers.onPointerleave"
      >
        <div v-if="hasTitle" :id="`${id}-title`" class="ui-popover__title">
          <slot name="title">{{ title }}</slot>
        </div>
        <slot name="content" />
      </SC_Popover>
    </Transition>
  </UiPortal>
</template>

<script setup lang="ts">
// Панель у кнопки вместо antd Popover: немодальное окно рядом с кнопкой
// (role="dialog"). Своего узла вокруг кнопки нет — aria и обработчики на
// элементе из слота; панель — в #ui-layers, содержимое создаётся при открытии.
import { computed, Comment, h, useAttrs, useSlots } from 'vue'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef, useTriggerElement } from '@/components/ui-core/trigger'
import { usePopup } from './popup'
import type { PopoverProps, PopupEmits } from './types'
import { SC_Popover } from './styled'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<PopoverProps>(), {
  open: undefined,
  trigger: 'click',
  placement: 'top',
  mouseEnterDelay: undefined,
  overlayClass: undefined,
  title: undefined,
  role: 'dialog',
  panelLabel: undefined,
})
const emit = defineEmits<PopupEmits>()
const slots = useSlots()
const attrs = useAttrs()

const trigger = useTriggerElement()
const { el: panelEl, setRef: setPanel } = useElementRef()

const hasTitle = computed<boolean>(() => Boolean(props.title || slots.title))

const { id, isOpen, triggerHandlers, panelHandlers } = usePopup(props, emit, trigger.el, panelEl, {
  kind: 'popover',
  defaultPlacement: 'top',
  // Зазор как у antd (там в нём стояла стрелка).
  offset: 16,
})

/** Уходящая панель (анимация закрытия) — уже закрытая для стилей и тестов. */
function markClosed(el: Element): void {
  ;(el as HTMLElement).dataset.state = 'closed'
}

function renderTrigger() {
  return (
    trigger.render(slots.default?.(), {
      ...attrs,
      ...triggerHandlers,
      'aria-haspopup': 'dialog',
      'aria-expanded': String(isOpen.value),
      'aria-controls': isOpen.value ? id : undefined,
    }) ?? h(Comment)
  )
}
</script>
