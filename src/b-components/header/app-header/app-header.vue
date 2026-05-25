<template>
  <SC_Header>
    <SC_Sections>
      <SC_HamburgerButton aria-label="Меню" @click="openDrawer">
        <MenuOutlined />
      </SC_HamburgerButton>

      <HeaderLogo />

      <HeaderSearch v-if="!mobile" />

      <SC_Right v-hide-zero-width>
        <HeaderTor v-if="!mobile" />
        <HeaderEvents v-if="!mobile" />
        <HeaderNotifications />
        <HeaderReportBug v-if="!mobile" />
        <SC_MessengerWrapper v-if="showMessengerIcon" @click="toggleMessenger">
          <CloseOutlined v-if="isFullScreen" :style="{ fontSize: '20px' }" />
          <MessageOutlined v-else :style="{ fontSize: '20px' }" />
          <SC_UnreadBadge v-if="!isFullScreen && unreadBadge">{{ unreadBadge }}</SC_UnreadBadge>
        </SC_MessengerWrapper>

        <HeaderUser />
      </SC_Right>
    </SC_Sections>
  </SC_Header>

  <MobileNavDrawer :is-open="drawerOpen" @close="closeDrawer" />
</template>

<script>
import { appHeaderOptions } from './app-header.ts'

export default appHeaderOptions
</script>
