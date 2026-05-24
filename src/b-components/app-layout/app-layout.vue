<template>
  <SC_Application id='application' class='menu-hide' :class='{ "is-mobile": mobile }'>
    <SC_Camera id='camera'></SC_Camera>
    <StarExplosion />

    <SC_Appcnt :class='{ "with-bottom-nav": mobile }'>
      <AppHeader />
      <router-view />
    </SC_Appcnt>

    <MessengerWrapper v-if='!mobile' />

    <PostModal />

    <WhatsNewModal />

    <MobileBottomNav v-if='mobile' />
  </SC_Application>
</template>

<script>
import { appLayoutOptions } from './app-layout.ts'

export default appLayoutOptions
</script>

