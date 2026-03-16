<template>
  <SC_ListItem>
    <Avatar
      :src="dialog.partner.avatar"
      :alt="dialog.partner.name || dialog.partner.id"
      :fallbackText="dialog.partner.name || dialog.partner.id"
      :size="48"
      :verified="dialog.partner.verified"
      shape="circle"
      style="margin-right: 12px;"
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

        <SC_DotsBtn
          class="dots-btn"
          @click.stop="toggleMenu"
        >
          <EllipsisOutlined />
        </SC_DotsBtn>

        <Teleport to="body">
          <div v-if="menuOpen">
            <SC_Overlay @click.stop="menuOpen = false" />
            <SC_Dropdown :style="dropdownStyle">
              <SC_DropdownItem @click.stop="onDelete">
                <DeleteOutlined style="margin-right: 8px; color: #e53935;" />
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

<script lang="ts">
import { chatListItemOptions } from './chat-list-item'

export default chatListItemOptions
</script>
