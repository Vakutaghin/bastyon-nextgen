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

      <SC_Badge v-if="dialog.unreadCount > 0">
        {{ dialog.unreadCount > 99 ? '99+' : dialog.unreadCount }}
      </SC_Badge>
    </SC_Meta>
  </SC_ListItem>
</template>

<script lang="ts">
import { chatListItemOptions } from './chat-list-item'

export default chatListItemOptions
</script>
