<template>
  <SC_TagsField>
    <SC_TagsRow @click="focusInput">
      <SC_TagChip v-for="tag in tags" :key="tag">
        #{{ tag }}
        <SC_TagRemove
          type="button"
          :aria-label="t('postComposer.removeTag', { tag })"
          @click.stop="emit('remove', tag)"
        >
          ×
        </SC_TagRemove>
      </SC_TagChip>
      <SC_TagInput
        ref="inputRef"
        :value="inputValue"
        :disabled="full"
        :placeholder="full ? '' : t('postComposer.tagsPlaceholder')"
        :aria-label="t('postComposer.tagsPlaceholder')"
        @input="onInput"
        @keydown="onKeydown"
        @focus="open = true"
        @blur="onBlur"
      />
    </SC_TagsRow>

    <SC_Dropdown v-if="open && suggestions.length">
      <SC_Suggestion
        v-for="(s, i) in suggestions"
        :key="s"
        :active="i === activeIndex"
        @mousedown.prevent="select(s)"
      >
        #{{ s }}
      </SC_Suggestion>
    </SC_Dropdown>
  </SC_TagsField>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRpcQuery } from '@/composables/use-rpc-query'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'

import {
  SC_Dropdown,
  SC_Suggestion,
  SC_TagChip,
  SC_TagInput,
  SC_TagRemove,
  SC_TagsField,
  SC_TagsRow,
} from './composer-tags.styled'
import { filterTagSuggestions } from './tag-suggestions'

const props = defineProps<{ tags: string[]; full: boolean; inputValue: string }>()
const emit = defineEmits<{
  (e: 'add', raw: string): void
  (e: 'remove', tag: string): void
  (e: 'backspace'): void
  (e: 'update:inputValue', value: string): void
}>()

const { t, locale } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)

// Облако трендовых тегов (gettags не умеет префикс-поиск — фильтруем на клиенте).
const { data: tagsResponse } = useRpcQuery(
  ['tags', 'cloud', locale.value],
  {
    method: rpcEndpoints.getTags,
    parameters: ['', '100', '', locale.value],
    options: { auth: false },
  },
  { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false }
)

interface RawTag {
  tag?: string
  name?: string
}

const cloud = computed<string[]>(() => {
  const response = tagsResponse.value as unknown
  let raw: RawTag[] = []
  if (Array.isArray(response)) raw = response as RawTag[]
  else if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>
    if (Array.isArray(r.data)) raw = r.data as RawTag[]
    else if (Array.isArray(r.result)) raw = r.result as RawTag[]
    else if (Array.isArray(r.tags)) raw = r.tags as RawTag[]
  }
  return raw.map((item) => item.tag || item.name || '').filter(Boolean)
})

const suggestions = computed(() => filterTagSuggestions(cloud.value, props.inputValue, props.tags))

const focusInput = (): void => {
  inputRef.value?.focus()
}

const onInput = (e: Event): void => {
  emit('update:inputValue', (e.target as HTMLInputElement).value)
  open.value = true
  activeIndex.value = 0
}

const select = (tag: string): void => {
  emit('add', tag)
  open.value = false
  activeIndex.value = 0
}

const onBlur = (): void => {
  // Задержка, чтобы успел отработать выбор подсказки.
  setTimeout(() => {
    open.value = false
  }, 120)
}

const onKeydown = (e: KeyboardEvent): void => {
  const list = suggestions.value
  if (open.value && list.length > 0) {
    if (e.key === 'ArrowDown') {
      activeIndex.value = Math.min(activeIndex.value + 1, list.length - 1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowUp') {
      activeIndex.value = Math.max(activeIndex.value - 1, 0)
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      open.value = false
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      select(list[activeIndex.value])
      return
    }
  }

  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
    if (props.inputValue.trim()) {
      e.preventDefault()
      emit('add', props.inputValue)
    }
    return
  }

  if (e.key === 'Backspace' && !props.inputValue) {
    emit('backspace')
  }
}
</script>
