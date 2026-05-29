<template>
  <SC_EditFormWrap @click.stop>
    <SC_ReplyInputWrap>
      <SC_ReplyTextarea
        ref="textareaRef"
        :value="editDraft"
        placeholder="Текст комментария…"
        rows="3"
        @input="onInput"
        @keydown="onKeydown"
      />
      <SC_LengthCounter v-if="lengthHint" :class="{ 'length-counter--bad': lengthHint.isOver }">
        {{ lengthHint.text }}
      </SC_LengthCounter>
    </SC_ReplyInputWrap>

    <SC_EditFormActions>
      <SC_EditCancelBtn
        type="button"
        :disabled="editSubmitting"
        @click.stop.prevent="emit('request-close')"
      >
        Отмена
      </SC_EditCancelBtn>
      <SC_EditSaveBtn type="button" :disabled="!canSubmit" @click.stop.prevent="emit('save')">
        <LoadingOutlined v-if="editSubmitting" :style="ICON_SIZE_SM" spin />
        <span v-else>Сохранить</span>
      </SC_EditSaveBtn>
    </SC_EditFormActions>
  </SC_EditFormWrap>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_SM } from '@/styles/icon-styles'
import {
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_LengthCounter,
  SC_EditFormWrap,
  SC_EditFormActions,
  SC_EditCancelBtn,
  SC_EditSaveBtn,
} from './styled'
import { getCommentLengthHint, isCommentLengthValid } from './helpers'

const props = defineProps<{
  editDraft: string
  initialDraft: string
  editSubmitting: boolean
}>()

const emit = defineEmits<{
  'update:editDraft': [value: string]
  'request-close': []
  save: []
}>()

const textareaRef = ref<HTMLTextAreaElement | { $el?: HTMLTextAreaElement } | null>(null)

const lengthHint = computed(() => getCommentLengthHint(props.editDraft || ''))

const isDirty = computed(() => (props.editDraft || '') !== (props.initialDraft || ''))

const canSubmit = computed(() => {
  const text = (props.editDraft || '').trim()
  if (!text) return false
  if (props.editSubmitting) return false
  if (!isCommentLengthValid(props.editDraft || '')) return false
  if (!isDirty.value) return false
  return true
})

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:editDraft', target.value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (canSubmit.value) emit('save')
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('request-close')
  }
}

onMounted(() => {
  // Автофокус и постановка курсора в конец
  const ref = textareaRef.value
  const el =
    ref && typeof (ref as HTMLTextAreaElement).focus === 'function'
      ? (ref as HTMLTextAreaElement)
      : (ref as { $el?: HTMLTextAreaElement })?.$el
  if (el && typeof el.focus === 'function') {
    el.focus()
    const len = (props.editDraft || '').length
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* noop */
    }
  }
})
</script>
