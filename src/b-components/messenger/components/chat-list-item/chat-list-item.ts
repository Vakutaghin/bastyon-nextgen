import { defineComponent, ref, computed, type PropType } from 'vue'
import { DeleteOutlined, EllipsisOutlined } from '@ant-design/icons-vue'

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
  SC_MenuWrap,
  SC_DotsBtn,
  SC_Dropdown,
  SC_DropdownItem,
  SC_Overlay,
  SC_ConfirmOverlay,
  SC_ConfirmDialog,
  SC_ConfirmTitle,
  SC_ConfirmText,
  SC_ConfirmButtons,
  SC_CancelBtn,
  SC_ConfirmDeleteBtn,
} from './styled'


export const chatListItemOptions = defineComponent({
  name: 'ChatListItem',
  components: {
    Avatar,
    DeleteOutlined,
    EllipsisOutlined,
    SC_ListItem,
    SC_Info,
    SC_Name,
    SC_LastMessage,
    SC_Meta,
    SC_Time,
    SC_Badge,
    SC_MenuWrap,
    SC_DotsBtn,
    SC_Dropdown,
    SC_DropdownItem,
    SC_Overlay,
    SC_ConfirmOverlay,
    SC_ConfirmDialog,
    SC_ConfirmTitle,
    SC_ConfirmText,
    SC_ConfirmButtons,
    SC_CancelBtn,
    SC_ConfirmDeleteBtn,
  },
  props: {
    dialog: {
      type: Object as PropType<Dialog>,
      required: true
    }
  },
  setup(props) {
    const store = useMessengerStore()
    const menuOpen = ref(false)
    const showConfirm = ref(false)
    const menuPos = ref({ top: 0, right: 0 })

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

    const dropdownStyle = computed(() => ({
      position: 'fixed' as const,
      top: `${menuPos.value.top}px`,
      right: `${menuPos.value.right}px`,
      zIndex: 10001,
    }))

    const toggleMenu = (e: MouseEvent) => {
      if (menuOpen.value) {
        menuOpen.value = false
        return
      }
      const btn = (e.currentTarget as HTMLElement)
      if (btn) {
        const rect = btn.getBoundingClientRect()
        menuPos.value = {
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        }
      }
      menuOpen.value = true
    }

    const onDelete = () => {
      menuOpen.value = false
      showConfirm.value = true
    }

    const confirmDelete = () => {
      showConfirm.value = false
      store.deleteDialog(props.dialog.id)
    }

    return { formatTime, isMine, menuOpen, showConfirm, toggleMenu, onDelete, confirmDelete, dropdownStyle }
  }
})
