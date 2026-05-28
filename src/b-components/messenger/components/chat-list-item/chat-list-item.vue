<template>
  <SC_ListItem :class="{ active: isActive }">
    <Avatar
      :src="dialog.partner.avatar"
      :alt="dialog.partner.name || dialog.partner.id"
      :fallback-text="dialog.partner.name || dialog.partner.id"
      :size="48"
      :verified="dialog.partner.verified"
      shape="circle"
      style="margin-right: 12px"
    />

    <SC_Info>
      <SC_Name>{{ dialog.partner.name }}</SC_Name>

      <SC_LastMessage v-if="dialog.lastMessage">
        <span v-if="isMine(dialog.lastMessage)">Вы: </span>
        {{ dialog.lastMessage.text }}
      </SC_LastMessage>
    </SC_Info>

    <SC_Meta>
      <SC_Time v-if="dialog.lastMessage">
        {{ formatTime(dialog.lastMessage.timestamp) }}
      </SC_Time>

      <SC_MenuWrap>
        <SC_Badge v-if="dialog.unreadCount > 0 && !menuOpen">
          {{ dialog.unreadCount > 99 ? '99+' : dialog.unreadCount }}
        </SC_Badge>

        <SC_DotsBtn class="dots-btn" @click.stop="toggleMenu">
          <EllipsisOutlined />
        </SC_DotsBtn>

        <Teleport to="body">
          <div v-if="menuOpen">
            <SC_Overlay @click.stop="menuOpen = false" />
            <SC_Dropdown :style="dropdownStyle">
              <SC_DropdownItem @click.stop="onDelete">
                <DeleteOutlined :style="{ marginRight: '8px', color: 'var(--color-red-ant)' }" />
                Удалить диалог
              </SC_DropdownItem>
            </SC_Dropdown>
          </div>
        </Teleport>
      </SC_MenuWrap>
    </SC_Meta>

    <Teleport to="body">
      <SC_ConfirmOverlay v-if="showConfirm" @click="showConfirm = false">
        <SC_ConfirmDialog @click.stop>
          <SC_ConfirmTitle>Удалить диалог?</SC_ConfirmTitle>
          <SC_ConfirmText>
            Диалог с {{ dialog.partner.name }} будет удалён. Это действие нельзя отменить.
          </SC_ConfirmText>
          <SC_ConfirmButtons>
            <SC_CancelBtn @click="showConfirm = false">Отмена</SC_CancelBtn>
            <SC_ConfirmDeleteBtn @click="confirmDelete">Удалить</SC_ConfirmDeleteBtn>
          </SC_ConfirmButtons>
        </SC_ConfirmDialog>
      </SC_ConfirmOverlay>
    </Teleport>
  </SC_ListItem>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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

const props = defineProps<{ dialog: Dialog }>()
const store = useMessengerStore()

const menuOpen = ref(false)
const showConfirm = ref(false)
const menuPos = ref({ top: 0, right: 0 })

/** Этот диалог сейчас открыт в чат-комнате — подсвечиваем его в списке слева. */
const isActive = computed<boolean>(() => store.activeChatId === props.dialog.id)

const dropdownStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${menuPos.value.top}px`,
  right: `${menuPos.value.right}px`,
  zIndex: 10001,
}))

function formatTime(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isMine(message: Message): boolean {
  return message.senderId === 'me' || message.senderId === store.currentUser.id
}

function toggleMenu(e: MouseEvent): void {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  const btn = e.currentTarget as HTMLElement | null
  if (btn) {
    const rect = btn.getBoundingClientRect()
    menuPos.value = {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    }
  }
  menuOpen.value = true
}

function onDelete(): void {
  menuOpen.value = false
  showConfirm.value = true
}

function confirmDelete(): void {
  showConfirm.value = false
  store.deleteDialog(props.dialog.id)
}
</script>
