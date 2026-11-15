<template>
  <SC_Select
    class="ui-select"
    :class="attrs.class"
    :data-size="size"
    :data-state="isOpen ? 'open' : 'closed'"
    :data-disabled="disabled || undefined"
    :data-multiple="multiple || undefined"
  >
    <button
      v-bind="triggerAttrs"
      :ref="setTrigger"
      type="button"
      class="ui-select__trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? listId : undefined"
      :aria-activedescendant="activeId"
      :disabled="disabled"
      @mousedown="onTriggerMousedown"
      @click="onTriggerClick"
      @keydown="onKeydown"
      @blur="onTriggerBlur"
    >
      <span v-if="hasValue" class="ui-select__value">{{ display }}</span>
      <span v-else class="ui-select__placeholder">{{ placeholder }}</span>
      <CaretDownOutlined class="ui-select__arrow" />
    </button>
    <UiPortal>
      <SC_SelectPanel
        v-if="isOpen"
        :ref="setPanel"
        class="ui-select-panel"
        data-state="open"
        @mousedown.prevent
      >
        <ul
          :id="listId"
          class="ui-select__list"
          role="listbox"
          :aria-label="listLabel"
          :aria-multiselectable="multiple ? 'true' : undefined"
        >
          <li
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="String(option.value)"
            class="ui-select__option"
            role="option"
            :aria-selected="isSelected(option)"
            :aria-disabled="option.disabled ? 'true' : undefined"
            :data-active="index === activeIndex || undefined"
            @mousemove="onOptionMousemove(index)"
            @click="choose(index)"
          >
            <span class="ui-select__label">{{ option.label }}</span>
            <CheckOutlined v-if="isSelected(option)" class="ui-select__check" />
          </li>
        </ul>
        <div v-if="!options.length" class="ui-select__empty">
          {{ notFoundContent ?? t('common.noData') }}
        </div>
      </SC_SelectPanel>
    </UiPortal>
  </SC_Select>
</template>

<script setup lang="ts">
// Поле выбора вместо antd Select. Части: .ui-select (data-size, data-state,
// data-disabled, data-multiple) > __trigger (role=combobox) > __value |
// __placeholder, __arrow; список в слое — .ui-select-panel > __list
// (role=listbox) > __option (aria-selected, aria-disabled, data-active) >
// __label, __check; пустой — __empty. Атрибуты (id для <label for>,
// aria-label, data-testid) — на поле, class — на корень.
import { computed, useAttrs } from 'vue'
import { CaretDownOutlined, CheckOutlined } from '@/components/icons'
import UiPortal from '@/components/ui-core/ui-portal.vue'
import { useElementRef } from '@/components/ui-core/trigger'
import { t } from '@/i18n'
import { useSelect } from './select'
import type { SelectEmits, SelectProps } from './types'
import { SC_Select, SC_SelectPanel } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<SelectProps>(), {
  value: undefined,
  mode: undefined,
  size: 'large',
  disabled: false,
  placeholder: undefined,
  notFoundContent: undefined,
  dropdownMatchSelectWidth: true,
  formatValue: undefined,
})
const emit = defineEmits<SelectEmits>()
const attrs = useAttrs()

const triggerAttrs = computed(() => {
  const rest: Record<string, unknown> = { ...attrs }
  delete rest.class
  return rest
})

const { el: triggerEl, setRef: setTrigger } = useElementRef()
const { el: panelEl, setRef: setPanel } = useElementRef()

const {
  listId,
  optionId,
  isOpen,
  activeIndex,
  activeId,
  listLabel,
  multiple,
  hasValue,
  display,
  isSelected,
  choose,
  onKeydown,
  onTriggerMousedown,
  onTriggerClick,
  onTriggerBlur,
  onOptionMousemove,
} = useSelect(p, emit, triggerEl, panelEl)
</script>
