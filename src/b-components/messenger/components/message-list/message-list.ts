import {
  defineComponent,
  nextTick,
  onMounted,
  type PropType,
  ref,
  watch,
} from 'vue'

import type { Message } from '../../types'
import MessageItem from '../message-item/message-item.vue'


export const messageListOptions = defineComponent({
  name: 'MessageList',
  components: {
    MessageItem
  },
  props: {
    messages: {
      type: Array as PropType<Message[]>,
      default: () => []
    }
  },
  emits: ['load-more'],
  setup(props, { emit }) {
    const listRef = ref<HTMLDivElement | { $el: HTMLDivElement } | null>(null)

    const getListEl = (): HTMLDivElement | null => {
      const v = listRef.value
      if (!v) return null
      return (v as { $el?: HTMLDivElement }).$el ?? (v as HTMLDivElement)
    }

    const scrollToBottom = async () => {
      await nextTick()
      const el = getListEl()
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }

    const checkAndLoadMore = () => {
      const el = getListEl()
      if (el && el.scrollHeight <= el.clientHeight + 100) {
        emit('load-more')
      }
    }

    onMounted(() => {
      scrollToBottom()
      setTimeout(checkAndLoadMore, 1000)
    })

    watch(() => props.messages, async (newVal, oldVal) => {
      const el = getListEl()
      if (!el) return

      const oldScrollHeight = el.scrollHeight
      const oldScrollTop = el.scrollTop
      const isAtBottom = oldScrollHeight - oldScrollTop - el.clientHeight < 100

      await nextTick()

      const newScrollHeight = el.scrollHeight

      if (newVal !== oldVal) {
        // Check if it's the same chat (last message is the same)
        const isSameChat = newVal.length > 0 && oldVal && oldVal.length > 0 &&
                           newVal[newVal.length - 1]?.id === oldVal[oldVal.length - 1]?.id

        if (!oldVal || oldVal.length === 0 || !isSameChat) {
          // New chat or initial load
          el.scrollTop = newScrollHeight
          setTimeout(checkAndLoadMore, 500)
          return
        }

        // History loaded (prepend)
        if (newVal.length > oldVal.length && newVal[0]?.id !== oldVal[0]?.id) {
          el.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight)
          return
        }
      }

      // Append or Mutation
      if (isAtBottom) {
        el.scrollTop = newScrollHeight
      }
    }, { deep: true })

    let lastScrollTime = 0

    const handleScroll = (e: Event) => {
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

    const shouldShowName = (index: number) => {
      if (index === 0) return true
      const current = props.messages[index]
      const previous = props.messages[index - 1]
      return current?.senderId !== previous?.senderId
    }

    return { listRef, shouldShowName, handleScroll }
  }
})
