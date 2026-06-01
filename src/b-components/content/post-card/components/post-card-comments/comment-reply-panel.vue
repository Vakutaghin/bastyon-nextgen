<template>
  <!-- Current user avatar -->
  <div v-if="currentUserAvatarUrl" class="reply-avatar">
    <img
      :src="currentUserAvatarUrl"
      :alt="t('comments.yourAvatar')"
      loading="lazy"
      decoding="async"
    />
  </div>
  <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>

  <!-- Cancel confirmation -->
  <SC_ConfirmWrap v-if="showCancelModal">
    <SC_ConfirmMessage>{{ t('comments.cancelConfirmMessage') }}</SC_ConfirmMessage>
    <SC_ConfirmActions>
      <SC_ConfirmBtn type="button" @click.stop.prevent="emit('update:showCancelModal', false)">
        {{ t('comments.no') }}
      </SC_ConfirmBtn>
      <SC_ConfirmBtn
        type="button"
        class="confirm-btn--primary"
        @click.stop.prevent="emit('confirm-cancel')"
      >
        {{ t('comments.yesCancel') }}
      </SC_ConfirmBtn>
    </SC_ConfirmActions>
  </SC_ConfirmWrap>

  <!-- Input form -->
  <template v-else>
    <SC_ReplyInputWrap>
      <SC_ReplyTextarea
        :key="replyPanelKey"
        ref="replyTextareaRef"
        :value="replyDraft"
        :placeholder="t('comments.replyPlaceholder')"
        rows="2"
        @input="onInput"
        @keydown="(e: KeyboardEvent) => emit('keydown', e)"
      />
      <SC_MentionList
        ref="mentionListRef"
        v-if="showMentionList && filteredMentionUsers.length > 0"
      >
        <SC_MentionItem
          v-for="(u, idx) in filteredMentionUsers"
          :key="u.address"
          type="button"
          :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
          @click.stop.prevent="emit('select-mention', u)"
        >
          {{ u.name }}
        </SC_MentionItem>
      </SC_MentionList>
      <SC_LengthCounter v-if="lengthHint" :class="{ 'length-counter--bad': lengthHint.isOver }">
        {{ lengthHint.text }}
      </SC_LengthCounter>
    </SC_ReplyInputWrap>
    <APopover v-model:open="emojiOpen" trigger="click" placement="topRight">
      <template #content>
        <CommentEmojiPicker @select="insertEmoji" />
      </template>
      <SC_EmojiTriggerBtn type="button" :title="t('comments.emoji')" @click.stop>
        <SmileOutlined />
      </SC_EmojiTriggerBtn>
    </APopover>
    <SC_ReplyCancelBtn
      type="button"
      :title="t('comments.cancel')"
      @click.stop.prevent="emit('request-close')"
    >
      <CloseOutlined />
    </SC_ReplyCancelBtn>
    <SC_ReplySendBtn
      type="button"
      :title="t('comments.send')"
      :disabled="!(replyDraft || '').trim() || replySubmitting || !lengthValid"
      @click.stop.prevent="emit('send')"
    >
      <LoadingOutlined v-if="replySubmitting" :style="ICON_SIZE_SM" spin />
      <SendOutlined v-else />
    </SC_ReplySendBtn>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover } from 'ant-design-vue'
import { LoadingOutlined, CloseOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons-vue'
import { ICON_SIZE_SM } from '@/styles/icon-styles'
import {
  SC_ConfirmWrap,
  SC_ConfirmMessage,
  SC_ConfirmActions,
  SC_ConfirmBtn,
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_MentionList,
  SC_MentionItem,
  SC_ReplyCancelBtn,
  SC_ReplySendBtn,
  SC_LengthCounter,
  SC_EmojiTriggerBtn,
} from './styled'
import CommentEmojiPicker from './comment-emoji-picker.vue'
import { getCommentLengthHint, isCommentLengthValid } from './helpers'

const APopover = Popover

interface MentionUser {
  address: string
  name: string
}

const props = defineProps<{
  currentUserAvatarUrl: string | null
  currentUserInitial: string
  showCancelModal: boolean
  replyDraft: string
  replyPanelKey: string
  replySubmitting: boolean
  showMentionList: boolean
  filteredMentionUsers: Array<MentionUser>
  mentionHighlightIndex: number
}>()

const { t } = useI18n()

const lengthHint = computed(() => getCommentLengthHint(props.replyDraft || ''))
const lengthValid = computed(() => isCommentLengthValid(props.replyDraft || ''))

const emit = defineEmits<{
  'update:replyDraft': [value: string]
  'update:showCancelModal': [value: boolean]
  'confirm-cancel': []
  input: [event: Event]
  keydown: [event: KeyboardEvent]
  'select-mention': [user: MentionUser]
  'request-close': []
  send: []
}>()

const replyTextareaRef = ref<InstanceType<typeof SC_ReplyTextarea> | null>(null)
const mentionListRef = ref<InstanceType<typeof SC_MentionList> | null>(null)
const emojiOpen = ref(false)

const onInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:replyDraft', target.value)
  emit('input', e)
}

function getTextareaEl(): HTMLTextAreaElement | null {
  const r = replyTextareaRef.value as HTMLTextAreaElement | { $el?: HTMLTextAreaElement } | null
  if (!r) return null
  if (typeof (r as HTMLTextAreaElement).focus === 'function') return r as HTMLTextAreaElement
  return (r as { $el?: HTMLTextAreaElement }).$el ?? null
}

function insertEmoji(emoji: string): void {
  emojiOpen.value = false
  const current = props.replyDraft || ''
  const el = getTextareaEl()
  if (!el) {
    emit('update:replyDraft', current + emoji)
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  const next = current.slice(0, start) + emoji + current.slice(end)
  emit('update:replyDraft', next)
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

defineExpose({
  replyTextareaRef,
  mentionListRef,
})
</script>
