<template>
  <UiPortal v-if="everOpened">
    <SC_DrawerRoot
      :ref="root.setRef"
      class="ui-drawer-root"
      :data-placement="side"
      :data-state="isOpen ? 'open' : 'closed'"
      data-popup-host
    >
      <Transition name="ui-fade" appear>
        <div v-show="isOpen" class="ui-drawer-mask" @click="onMaskClick" />
      </Transition>
      <Transition name="ui-drawer" appear>
        <div
          v-show="isOpen"
          :ref="panel.setRef"
          class="ui-drawer"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="hasTitle ? `${id}-title` : undefined"
        >
          <div v-if="hasTitle || closable !== false" class="ui-drawer__header">
            <div :id="`${id}-title`" class="ui-drawer__title">
              <slot name="title">{{ title }}</slot>
            </div>
            <button
              v-if="closable !== false"
              type="button"
              class="ui-drawer__close"
              :aria-label="t('common.close')"
              @click="close"
            >
              <CloseOutlined />
            </button>
          </div>
          <div class="ui-drawer__body"><slot /></div>
        </div>
      </Transition>
    </SC_DrawerRoot>
  </UiPortal>
</template>

<script setup lang="ts">
// Шторка вместо antd Drawer (справка): сбоку или снизу, с маской. Части —
// .ui-drawer-root (data-placement) > .ui-drawer-mask + .ui-drawer (role=dialog)
// > __header (__title, __close), __body.
import { computed, useSlots } from 'vue'
import { CloseOutlined } from '@/components/icons'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef } from '@/components/ui-core/trigger'
import { t } from '@/i18n'
import { useDrawer } from './drawer'
import type { DrawerEmits, DrawerProps } from './types'
import { SC_DrawerRoot } from './styled'

const p = withDefaults(defineProps<DrawerProps>(), {
  open: false,
  placement: 'right',
  width: undefined,
  height: undefined,
  title: undefined,
  closable: undefined,
  maskClosable: undefined,
})
const emit = defineEmits<DrawerEmits>()
const slots = useSlots()

const root = useElementRef()
const panel = useElementRef()

const side = computed(() => p.placement)
const hasTitle = computed<boolean>(() => Boolean(p.title || slots.title))

const { id, isOpen, everOpened, close, onMaskClick } = useDrawer(p, emit, root.el, panel.el)
</script>
