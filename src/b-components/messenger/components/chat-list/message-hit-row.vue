<template>
  <!-- Найденное сообщение: чат и когда, ниже — кто написал и слова в контексте. -->
  <SC_PersonRow type="button" data-testid="chat-search-message">
    <GroupAvatar
      v-if="dialog.group"
      :src="dialog.partner.avatar"
      :name="dialog.partner.name"
      :member-ids="dialog.group.previewIds"
      :size="40"
    />
    <Avatar
      v-else
      :src="dialog.partner.avatar"
      :alt="dialog.partner.name || dialog.partner.id"
      :fallback-text="dialog.partner.name || dialog.partner.id"
      :size="40"
      :verified="dialog.partner.verified"
      :mark="dialog.partner.mark"
      shape="circle"
    />
    <SC_HitInfo>
      <SC_HitHead>
        <SC_PersonName>{{ dialog.partner.name }}</SC_PersonName>
        <SC_HitTime>{{ when }}</SC_HitTime>
      </SC_HitHead>
      <SC_HitText>
        <SC_HitSender v-if="sender">{{ sender }}</SC_HitSender>
        <span v-if="mediaMark" aria-hidden="true">{{ mediaMark }} </span>
        <template v-for="(part, i) in parts" :key="i">
          <mark v-if="part.mark">{{ part.text }}</mark>
          <span v-else>{{ part.text }}</span>
        </template>
      </SC_HitText>
    </SC_HitInfo>
  </SC_PersonRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/components/avatar/avatar.vue'
import { formatShortDate } from '@/helpers/common/date-formatter'
import { isGroupDialog, type Dialog, type Message } from '../../types'
import { useMessengerStore } from '../../store'
import { chatUserName } from '../../helpers'
import { searchableText, snippetParts } from '../../lib/message-search'
import GroupAvatar from '../group-avatar/group-avatar.vue'
import {
  SC_HitHead,
  SC_HitInfo,
  SC_HitSender,
  SC_HitText,
  SC_HitTime,
  SC_PersonName,
  SC_PersonRow,
} from './styled'

/** Файл, фото, видео и голосовое находятся по имени — значок перед ним. */
const MEDIA_MARKS: Partial<Record<NonNullable<Message['type']>, string>> = {
  file: '📎',
  image: '🖼',
  video: '🎬',
  audio: '🎤',
}

const props = defineProps<{ dialog: Dialog; message: Message; tokens: readonly string[] }>()
const { t } = useI18n()
const store = useMessengerStore()

const when = computed<string>(() => formatShortDate(props.message.timestamp))

const isMine = computed<boolean>(
  () => props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
)

/** «Вы: » у своего; в группе — имя написавшего. В личном чате чужое — без подписи. */
const sender = computed<string>(() => {
  if (isMine.value) return t('chat.youPrefix')
  if (!isGroupDialog(props.dialog)) return ''
  const name = chatUserName(props.message.senderId, store.userProfiles, props.message.senderName)
  return name ? `${name}: ` : ''
})

const mediaMark = computed<string>(() => MEDIA_MARKS[props.message.type ?? 'text'] ?? '')

const parts = computed(() => snippetParts(searchableText(props.message), props.tokens))
</script>
