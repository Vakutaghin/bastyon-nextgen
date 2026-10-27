<template>
  <SC_MessageList ref="listRef" @scroll="handleScroll">
    <!-- Лента долистана до начала (или не загрузилась): откуда у чата такая история.
         У пустого чата пометку показывает сама комната. -->
    <ChatHistoryNote
      v-if="history && messages.length > 0 && (history.reachedStart || history.error)"
      :history="history"
      @retry="emit('retry')"
    />
    <template v-for="row in rows" :key="row.kind === 'message' ? row.message.id : row.id">
      <MessageItem
        v-if="row.kind === 'message'"
        :message="row.message"
        :show-name="isFirstInGroup(row.index)"
        :show-avatar="isFirstInGroup(row.index)"
        :seen="seenIds.has(row.message.id)"
        @reply="emit('reply', $event)"
      />
      <!-- Удалённое сообщение — отметка, кто удалил: раньше оно пропадало без следа. -->
      <SC_DeletedMark v-else data-testid="deleted-mark">
        {{ deletedText(row) }} ·
        <time :datetime="new Date(row.at).toISOString()">{{ formatMessageTime(row.at) }}</time>
      </SC_DeletedMark>
    </template>
  </SC_MessageList>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMessageTime } from '@/helpers/common/date-formatter'
import type { Message } from '../../types'
import { chatUserName } from '../../helpers'
import { historyRows, type ChatHistory, type HistoryRow } from '../../lib/chat-history'
import { useMessengerStore } from '../../store'
import MessageItem from '../message-item/message-item.vue'
import ChatHistoryNote from '../chat-history-note/chat-history-note.vue'
import { SC_DeletedMark } from '../chat-history-note/styled'
import { SC_MessageList } from './styled'

const props = withDefaults(
  defineProps<{
    messages?: Message[]
    /** Свои сообщения, которые уже прочитали (use-read-receipts). */
    seenIds?: ReadonlySet<string>
    /** Что известно об истории чата (lib/chat-history); у mesh-чатов нет. */
    history?: ChatHistory | null
  }>(),
  {
    messages: () => [],
    seenIds: () => new Set<string>(),
    history: null,
  }
)

const emit = defineEmits<{
  'load-more': []
  reply: [message: Message]
  retry: []
}>()

const { t } = useI18n()
const store = useMessengerStore()

const rows = computed<HistoryRow[]>(() => historyRows(props.messages))

function deletedText(row: Extract<HistoryRow, { kind: 'deleted' }>): string {
  if (row.by === store.currentUser.id) {
    return row.count === 1
      ? t('messenger.history.deletedOneByYou')
      : t('messenger.history.deletedManyByYou', { n: row.count }, row.count)
  }
  const name = chatUserName(row.by, store.userProfiles)
  return row.count === 1
    ? t('messenger.history.deletedOne', { name })
    : t('messenger.history.deletedMany', { name, n: row.count }, row.count)
}

const listRef = ref<HTMLDivElement | { $el: HTMLDivElement } | null>(null)

function getListEl(): HTMLDivElement | null {
  const v = listRef.value
  if (!v) return null
  return (v as { $el?: HTMLDivElement }).$el ?? (v as HTMLDivElement)
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = getListEl()
  if (el) el.scrollTop = el.scrollHeight
}

function checkAndLoadMore(): void {
  const el = getListEl()
  if (el && el.scrollHeight <= el.clientHeight + 100) {
    emit('load-more')
  }
}

onMounted(() => {
  scrollToBottom()
  setTimeout(checkAndLoadMore, 1000)
})

watch(
  () => props.messages,
  async (newVal, oldVal) => {
    const el = getListEl()
    if (!el) return

    const oldScrollHeight = el.scrollHeight
    const oldScrollTop = el.scrollTop
    const isAtBottom = oldScrollHeight - oldScrollTop - el.clientHeight < 100

    await nextTick()

    const newScrollHeight = el.scrollHeight

    if (newVal !== oldVal) {
      const isSameChat =
        newVal.length > 0 &&
        oldVal &&
        oldVal.length > 0 &&
        newVal[newVal.length - 1]?.id === oldVal[oldVal.length - 1]?.id

      if (!oldVal || oldVal.length === 0 || !isSameChat) {
        // Новый чат или начальная загрузка — прыгаем в самый низ.
        el.scrollTop = newScrollHeight
        setTimeout(checkAndLoadMore, 500)
        return
      }

      // История подгрузилась в начало (prepend) — сохраняем визуальную позицию,
      // компенсируя сдвиг от добавленных сверху сообщений.
      if (newVal.length > oldVal.length && newVal[0]?.id !== oldVal[0]?.id) {
        el.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
        return
      }
    }

    if (isAtBottom) {
      el.scrollTop = newScrollHeight
    }
  },
  { deep: true }
)

let lastScrollTime = 0

function handleScroll(e: Event): void {
  const target = e.target as HTMLElement
  if (target.scrollTop < 200) {
    const now = Date.now()
    if (now - lastScrollTime > 500) {
      console.error('[MessageList] Load more triggered (emit load-more)')
      emit('load-more')
      lastScrollTime = now
    }
  }
}

/**
 * Сообщение — первое в подряд идущей серии от одного отправителя.
 * Используется для показа имени и аватарки только у первого в группе:
 * визуально это даёт «слипшиеся» бабблы без повторов меты на каждом сообщении.
 */
function isFirstInGroup(index: number): boolean {
  if (index === 0) return true
  const current = props.messages[index]
  const previous = props.messages[index - 1]
  // После отметки «удалено» серия начинается заново.
  return current?.senderId !== previous?.senderId || !!previous?.deleted
}
</script>
