import { defineComponent } from 'vue'
import { SC_Window, SC_Header, SC_Title, SC_Content } from './styled'

export const messengerWindowOptions = defineComponent({
  name: 'MessengerWindow',
  components: {
    SC_Window,
    SC_Header,
    SC_Title,
    SC_Content
  },
  props: {
    isOpen: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Messenger'
    }
  },
  emits: ['close']
})
