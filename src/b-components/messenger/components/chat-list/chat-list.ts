import { defineComponent, type PropType } from 'vue'
import type { Dialog } from '../../types'
import { SC_ChatList } from './styled'
import ChatListItem from '../chat-list-item/chat-list-item.vue'

export const chatListOptions = defineComponent({
  name: 'ChatList',
  components: {
    SC_ChatList,
    ChatListItem
  },
  props: {
    dialogs: {
      type: Array as PropType<Dialog[]>,
      required: true
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const onSelect = (id: string) => {
      emit('select', id)
    }

    return {
      onSelect
    }
  }
})
