<template>
  <component :is="renderTrigger()" />
  <UiPortal>
    <Transition name="ui-pop">
      <SC_Tooltip
        v-if="visible"
        :id="id"
        :ref="setPanel"
        class="ui-tooltip"
        :class="overlayClass"
        role="tooltip"
        @pointerenter="panelHandlers.onPointerenter"
        @pointerleave="panelHandlers.onPointerleave"
      >
        <slot name="title">{{ title }}</slot>
      </SC_Tooltip>
    </Transition>
  </UiPortal>
</template>

<script setup lang="ts">
// Подсказка вместо antd Tooltip. Своего узла вокруг кнопки нет: обработчики и
// aria-describedby вешаются на элемент из слота, подсказка — в #ui-layers.
import { Comment, h, shallowRef, useAttrs, useSlots, type ComponentPublicInstance } from 'vue'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useTriggerElement } from '@/components/ui-core/trigger'
import { useTooltip } from './tooltip'
import type { TooltipProps } from './types'
import { SC_Tooltip } from './styled'

defineOptions({ inheritAttrs: false })

const props = defineProps<TooltipProps>()
const slots = useSlots()
const attrs = useAttrs()

const trigger = useTriggerElement()
const panelEl = shallowRef<HTMLElement | null>(null)

function setPanel(value: Element | ComponentPublicInstance | null): void {
  const node = value && '$el' in value ? value.$el : value
  panelEl.value = node instanceof HTMLElement ? node : null
}

const { id, visible, describedBy, triggerHandlers, panelHandlers } = useTooltip(
  props,
  () => Boolean(props.title || slots.title),
  trigger.el,
  panelEl
)

function renderTrigger() {
  return (
    trigger.render(slots.default?.(), {
      ...attrs,
      ...triggerHandlers,
      'aria-describedby': describedBy.value,
    }) ?? h(Comment)
  )
}
</script>
