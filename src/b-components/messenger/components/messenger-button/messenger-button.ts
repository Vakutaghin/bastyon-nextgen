import { defineComponent } from 'vue'
import { SC_MessengerButton, SC_UnreadBadge } from './styled'

export const messengerButtonOptions = defineComponent({
  name: 'MessengerButton',
  components: {
    SC_MessengerButton,
    SC_UnreadBadge
  },
  props: {
    unreadCount: {
      type: Number,
      default: 0
    },
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  setup(props, { emit }) {
    const handleClick = () => {
      emit('click')
    }

    return {
      handleClick
    }
  }
})
