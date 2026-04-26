<template>
  <!-- Current user avatar -->
  <div v-if="currentUserAvatarUrl" class="reply-avatar">
    <img :src="currentUserAvatarUrl" alt="" />
  </div>
  <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>

  <!-- Cancel confirmation -->
  <SC_ConfirmWrap v-if="showCancelModal">
    <SC_ConfirmMessage>Введённый текст будет удалён.</SC_ConfirmMessage>
    <SC_ConfirmActions>
      <SC_ConfirmBtn
        type="button"
        @click.stop.prevent="emit('update:showCancelModal', false)"
      >
        Нет
      </SC_ConfirmBtn>
      <SC_ConfirmBtn
        type="button"
        class="confirm-btn--primary"
        @click.stop.prevent="emit('confirm-cancel')"
      >
        Да, отменить
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
        placeholder="Введите ответ... (введите @ чтобы упомянуть пользователя)"
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
    </SC_ReplyInputWrap>
    <SC_ReplyCancelBtn
      type="button"
      title="Отменить"
      @click.stop.prevent="emit('request-close')"
    >
      <CloseOutlined />
    </SC_ReplyCancelBtn>
    <SC_ReplySendBtn
      type="button"
      title="Отправить"
      :disabled="!(replyDraft || '').trim() || replySubmitting"
      @click.stop.prevent="emit('send')"
    >
      <LoadingOutlined v-if="replySubmitting" :style="{ fontSize: '14px' }" spin />
      <SendOutlined v-else />
    </SC_ReplySendBtn>
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { LoadingOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons-vue'
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
} from './styled'

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

const emit = defineEmits<{
  'update:replyDraft': [value: string]
  'update:showCancelModal': [value: boolean]
  'confirm-cancel': []
  'input': [event: Event]
  'keydown': [event: KeyboardEvent]
  'select-mention': [user: MentionUser]
  'request-close': []
  'send': []
}>()

const replyTextareaRef = ref<InstanceType<typeof SC_ReplyTextarea> | null>(null)
const mentionListRef = ref<InstanceType<typeof SC_MentionList> | null>(null)

const onInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:replyDraft', target.value)
  emit('input', e)
}

defineExpose({
  replyTextareaRef,
  mentionListRef,
})
</script>
