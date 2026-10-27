<template>
  <SC_HistoryNote v-if="history?.error" class="error" role="status" data-testid="chat-history-note">
    <SC_HistoryLine>{{ errorText }}</SC_HistoryLine>
    <SC_HistoryDetails v-if="errorDetails">{{ errorDetails }}</SC_HistoryDetails>
    <SC_HistoryRetry type="button" @click="emit('retry')">
      {{ t('messenger.history.retry') }}
    </SC_HistoryRetry>
  </SC_HistoryNote>
  <SC_HistoryNote v-else-if="lines.length" role="note" data-testid="chat-history-note">
    <SC_HistoryLine v-for="line in lines" :key="line">{{ line }}</SC_HistoryLine>
  </SC_HistoryNote>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatLongDate } from '@/helpers/common/date-formatter'
import { chatUserName } from '../../helpers'
import type { ChatHistory } from '../../lib/chat-history'
import { useMessengerStore } from '../../store'
import { SC_HistoryDetails, SC_HistoryLine, SC_HistoryNote, SC_HistoryRetry } from './styled'

/**
 * Откуда у чата такая история: кто и когда его создал, стёр ли сервер часть
 * переписки, сколько он её хранит, не сломалась ли загрузка. Вверху ленты,
 * когда она долистана до начала, и вместо ленты у пустого чата.
 */
const props = withDefaults(
  defineProps<{
    history: ChatHistory | null | undefined
    /** Сообщений в чате нет. */
    empty?: boolean
  }>(),
  { empty: false }
)

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const store = useMessengerStore()

const DAY_MS = 86_400_000

function nameOf(matrixId: string): string {
  return chatUserName(matrixId, store.userProfiles)
}

function dated(text: string, ts?: number): string {
  return ts ? `${text} · ${formatLongDate(ts)}` : text
}

const errorText = computed<string>(() =>
  props.history?.error === 'room_not_found'
    ? t('messenger.history.roomMissing')
    : t('messenger.history.loadFailed')
)

const errorDetails = computed<string>(() => {
  const error = props.history?.error
  return error && error !== 'room_not_found' ? error.slice(0, 200) : ''
})

const lines = computed<string[]>(() => {
  const h = props.history
  const out: string[] = []
  if (!h) {
    if (props.empty) out.push(t('messenger.history.empty'))
    return out
  }
  if (h.invitedBy) {
    out.push(dated(t('messenger.history.invitedBy', { name: nameOf(h.invitedBy) }), h.invitedAt))
  } else if (h.createdBy) {
    const mine = h.createdBy === store.currentUser.id
    const text = mine
      ? t('messenger.history.createdByYou')
      : t('messenger.history.createdBy', { name: nameOf(h.createdBy) })
    out.push(dated(text, h.createdAt))
  }
  if (h.purged) {
    out.push(
      h.purgedBefore
        ? t('messenger.history.purgedBefore', { date: formatLongDate(h.purgedBefore) })
        : t('messenger.history.purged')
    )
  }
  if (h.retentionMs) {
    const days = Math.max(1, Math.round(h.retentionMs / DAY_MS))
    out.push(
      t('messenger.history.retention', {
        period: t('messenger.history.retentionDays', { n: days }, days),
      })
    )
  }
  if (props.empty && !h.invitedBy) out.push(t('messenger.history.empty'))
  return out
})
</script>
