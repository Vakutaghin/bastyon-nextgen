<template>
  <UiPortal v-if="rendered">
    <SC_ModalRoot :ref="root.setRef" class="ui-modal-root">
      <Transition name="ui-fade" appear>
        <div v-show="isOpen" class="ui-modal-mask" />
      </Transition>
      <div
        v-show="wrapVisible"
        class="ui-modal-wrap"
        :class="[wrapClass ?? wrapClassName]"
        :data-centered="centered ? '' : undefined"
        :data-state="isOpen ? 'open' : 'closed'"
        @pointerdown="onWrapPointerdown"
        @click="onWrapClick"
      >
        <Transition name="ui-zoom" appear @after-leave="onAfterLeave">
          <div
            v-show="isOpen"
            :ref="panel.setRef"
            class="ui-modal"
            :class="attrs.class"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            :aria-labelledby="hasTitle ? `${id}-title` : undefined"
            :aria-label="hasTitle ? undefined : (attrs['aria-label'] as string | undefined)"
            v-bind="panelAttrs"
          >
            <div class="ui-modal__content">
              <button
                v-if="closable !== false"
                type="button"
                class="ui-modal__close"
                :aria-label="t('common.close')"
                @click="cancel"
              >
                <CloseOutlined />
              </button>
              <div v-if="hasTitle" class="ui-modal__header">
                <div :id="`${id}-title`" class="ui-modal__title">
                  <slot name="title">{{ title }}</slot>
                </div>
              </div>
              <div class="ui-modal__body"><slot /></div>
              <div v-if="hasFooter" class="ui-modal__footer">
                <slot name="footer">
                  <component :is="() => footer" v-if="footer !== undefined" />
                  <template v-else-if="defaultFooter">
                    <Button :disabled="cancelButtonProps?.disabled" @click="cancel">
                      {{ cancelText ?? t('common.cancel') }}
                    </Button>
                    <Button
                      type="primary"
                      :danger="okType === 'danger' || okButtonProps?.danger"
                      :disabled="okButtonProps?.disabled"
                      :loading="confirmLoading || okButtonProps?.loading"
                      @click="onOk"
                    >
                      {{ okText ?? 'OK' }}
                    </Button>
                  </template>
                </slot>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </SC_ModalRoot>
  </UiPortal>
</template>

<script setup lang="ts">
// Окно вместо antd Modal (и прежней обёртки над ним). Разметка — как у antd,
// классы свои: .ui-modal-root > .ui-modal-mask + .ui-modal-wrap > .ui-modal
// (role="dialog", ширина, класс и атрибуты потребителя) > .ui-modal__content
// (карточка) > __close, __header > __title, __body, __footer. Логика — modal.ts.
import { computed, useAttrs, useSlots } from 'vue'
import Button from '@/components/button'
import { CloseOutlined } from '@/components/icons'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef } from '@/components/ui-core/trigger'
import { t } from '@/i18n'
import { useModal } from './modal'
import type { ModalEmits, ModalProps } from './types'
import { SC_ModalRoot } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<ModalProps>(), {
  open: undefined,
  modelValue: undefined,
  title: undefined,
  width: undefined,
  fullWidth: false,
  centered: false,
  closable: undefined,
  maskClosable: undefined,
  keyboard: undefined,
  destroyOnClose: false,
  // VNodeChild включает boolean → без default Vue кастует отсутствие в false.
  footer: undefined,
  okText: undefined,
  cancelText: undefined,
  okType: undefined,
  okButtonProps: undefined,
  cancelButtonProps: undefined,
  confirmLoading: false,
  onOk: undefined,
  wrapClass: undefined,
  wrapClassName: undefined,
  ignoreBack: false,
})
const emit = defineEmits<ModalEmits>()
const attrs = useAttrs()

const root = useElementRef()
const panel = useElementRef()

/** Атрибуты потребителя (data-testid и прочие) — на само окно, как у antd. */
const panelAttrs = computed(() => {
  const rest: Record<string, unknown> = { ...attrs }
  delete rest.class
  delete rest.style
  delete rest['aria-label']
  return rest
})

const {
  id,
  isOpen,
  rendered,
  wrapVisible,
  hasTitle,
  hasFooter,
  defaultFooter,
  cancel,
  onOk,
  onAfterLeave,
  onWrapPointerdown,
  onWrapClick,
} = useModal(p, emit, useSlots(), { root: root.el, panel: panel.el })
</script>
