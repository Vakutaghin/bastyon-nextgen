import { defineComponent, type PropType } from 'vue'

import type { Dialog, Message } from '../../types'
import { useMessengerStore } from '../../store'
import Avatar from '@/components/avatar/avatar.vue'
import {
  SC_ListItem,
  SC_Info,
  SC_Name,
  SC_LastMessage,
  SC_Meta,
  SC_Time,
  SC_Badge,
} from './styled'


export const chatListItemOptions = defineComponent({
  name: 'ChatListItem',
  components: {
    Avatar,
    SC_ListItem,
    SC_Info,
    SC_Name,
    SC_LastMessage,
    SC_Meta,
    SC_Time,
    SC_Badge
  },
  props: {
    dialog: {
      type: Object as PropType<Dialog>,
      required: true
    }
  },
  setup() {
    const store = useMessengerStore()

    const formatTime = (timestamp?: number) => {
      if (!timestamp) return ''

      return new Date(timestamp).toLocaleTimeString(
        [],
        { hour: '2-digit', minute: '2-digit' },
      )
    }

    const isMine = (message: Message) => {
      return message.senderId === 'me' || message.senderId === store.currentUser.id
    }

    return { formatTime, isMine }
  }
})
