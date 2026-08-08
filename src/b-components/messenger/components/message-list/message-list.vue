<template>
  <SC_MessageList ref="listRef" @scroll="handleScroll">
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id"
      :message="message"
      :show-name="isFirstInGroup(index)"
      :show-avatar="isFirstInGroup(index)"
      :seen-up-to-ts="seenUpToTs"
      @reply="emit('reply', $event)"
    />
  </SC_MessageList>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { Message } from '../../types'
import MessageItem from '../message-item/message-item.vue'
import { SC_MessageList } from './styled'

const props = withDefaults(defineProps<{ messages?: Message[]; seenUpToTs?: number }>(), {
  messages: () => [],
  seenUpToTs: 0,
})

const emit = defineEmits<{
  'load-more': []
  reply: [message: Message]
}>()

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
  return current?.senderId !== previous?.senderId
}
</script>
