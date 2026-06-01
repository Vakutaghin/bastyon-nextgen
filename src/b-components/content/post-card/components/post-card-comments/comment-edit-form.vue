<template>
  <SC_EditFormWrap @click.stop>
    <SC_ReplyInputWrap>
      <SC_ReplyTextarea
        ref="textareaRef"
        :value="editDraft"
        :placeholder="t('comments.editPlaceholder')"
        rows="3"
        @input="onInput"
        @keydown="onKeydown"
      />
      <SC_LengthCounter v-if="lengthHint" :class="{ 'length-counter--bad': lengthHint.isOver }">
        {{ lengthHint.text }}
      </SC_LengthCounter>
    </SC_ReplyInputWrap>

    <SC_EditFormActions>
      <APopover v-model:open="emojiOpen" trigger="click" placement="topLeft">
        <template #content>
          <CommentEmojiPicker @select="insertEmoji" />
        </template>
        <SC_EmojiTriggerBtn type="button" :title="t('comments.emoji')" @click.stop>
          <SmileOutlined />
        </SC_EmojiTriggerBtn>
      </APopover>
      <SC_EditFormSpacer />
      <SC_EditCancelBtn
        type="button"
        :disabled="editSubmitting"
        @click.stop.prevent="emit('request-close')"
      >
        {{ t('comments.cancelEdit') }}
      </SC_EditCancelBtn>
      <SC_EditSaveBtn type="button" :disabled="!canSubmit" @click.stop.prevent="emit('save')">
        <LoadingOutlined v-if="editSubmitting" :style="ICON_SIZE_SM" spin />
        <span v-else>{{ t('comments.save') }}</span>
      </SC_EditSaveBtn>
    </SC_EditFormActions>
  </SC_EditFormWrap>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover } from 'ant-design-vue'
import { LoadingOutlined, SmileOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_SM } from '@/styles/icon-styles'
import {
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_LengthCounter,
  SC_EditFormWrap,
  SC_EditFormActions,
  SC_EditFormSpacer,
  SC_EditCancelBtn,
  SC_EditSaveBtn,
  SC_EmojiTriggerBtn,
} from './styled'
import CommentEmojiPicker from './comment-emoji-picker.vue'
import { getCommentLengthHint, isCommentLengthValid } from './helpers'

const APopover = Popover

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

const { t } = useI18n()

const textareaRef = ref<HTMLTextAreaElement | { $el?: HTMLTextAreaElement } | null>(null)
const emojiOpen = ref(false)

function getTextareaEl(): HTMLTextAreaElement | null {
  const r = textareaRef.value
  if (!r) return null
  if (typeof (r as HTMLTextAreaElement).focus === 'function') return r as HTMLTextAreaElement
  return (r as { $el?: HTMLTextAreaElement }).$el ?? null
}

function insertEmoji(emoji: string): void {
  emojiOpen.value = false
  const current = props.editDraft || ''
  const el = getTextareaEl()
  if (!el) {
    emit('update:editDraft', current + emoji)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  emit('update:editDraft', current.slice(0, start) + emoji + current.slice(end))
  void nextTick(() => {
    el.focus()
    const pos = start + emoji.length
    try {
      el.setSelectionRange(pos, pos)
    } catch {
      /* noop */
    }
  })
}

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
