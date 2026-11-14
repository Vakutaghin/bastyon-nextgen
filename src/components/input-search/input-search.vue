<template>
  <SC_InputSearch v-bind="rootAttrs" class="ui-input-search">
    <!-- Поле без своей подписи: для диктора его название — подсказка в поле. -->
    <Input
      class="ui-input-search__field"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      :allow-clear="allowClear"
      :maxlength="maxlength"
      :aria-label="placeholder"
      v-bind="controlAttrs"
      @update:value="onValue"
      @press-enter="search"
      @clear="onClear"
    />
    <button
      type="button"
      class="ui-input-search__button"
      :disabled="disabled"
      :aria-busy="loading ? 'true' : undefined"
      @mousedown="keepFocus"
      @click="search"
    >
      <LoadingOutlined v-if="loading" />
      <SearchOutlined v-else />
      <!-- Значок скрыт от диктора — название кнопки словом. -->
      <span class="visually-hidden">{{ t('a11y.search') }}</span>
    </button>
  </SC_InputSearch>
</template>

<script setup lang="ts">
// Поле поиска с кнопкой вместо antd Input.Search: своё поле (components/input)
// и приставленная справа кнопка с лупой. Атрибуты потребителя (data-testid,
// autocomplete, aria-label) — на сам input, class и style — на корень.
import { t } from '@/i18n'
import Input from '@/components/input'
import { useSplitAttrs } from '@/components/input/input'
import { LoadingOutlined, SearchOutlined } from '@/components/icons'
import { useInputSearch } from './input-search'
import type { InputSearchEmits, InputSearchProps } from './types'
import { SC_InputSearch } from './styled'

defineOptions({ inheritAttrs: false })

const p = withDefaults(defineProps<InputSearchProps>(), {
  disabled: false,
  allowClear: false,
  loading: false,
})
const emit = defineEmits<InputSearchEmits>()

const { rootAttrs, controlAttrs } = useSplitAttrs()
const { onValue, search, onClear, keepFocus } = useInputSearch(p, emit)
</script>
