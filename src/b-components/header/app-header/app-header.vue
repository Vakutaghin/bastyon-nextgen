<template>
  <SC_Header>
    <SC_Sections>
      <HeaderLogo />

      <HeaderSearch />

      <SC_Right v-hide-zero-width>
        <HeaderTor />
        <HeaderEvents />
        <HeaderNotifications />
        <SC_MessengerWrapper v-if="showMessengerIcon" @click="toggleMessenger">
          <CloseOutlined v-if="isFullScreen" :style="{ fontSize: '20px' }" />
          <MessageOutlined v-else :style="{ fontSize: '20px' }" />
        </SC_MessengerWrapper>

        <HeaderUser />
      </SC_Right>
    </SC_Sections>
  </SC_Header>
</template>

<script>
import { appHeaderOptions } from './app-header.ts'

export default appHeaderOptions
</script>
