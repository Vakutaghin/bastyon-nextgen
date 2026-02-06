<template>
  <SC_MessengerButton @click="handleClick" :isOpen="isOpen">
    <slot name="icon" />
    <SC_UnreadBadge v-if="unreadCount > 0">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </SC_UnreadBadge>
  </SC_MessengerButton>
</template>

<script lang="ts">
import { messengerButtonOptions } from './messenger-button'

export default messengerButtonOptions
</script>
