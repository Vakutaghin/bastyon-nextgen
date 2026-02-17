<template>
  <SC_Application id='application' class='menu-hide'>
    <SC_Camera id='camera'></SC_Camera>
    <StarExplosion />

    <SC_Appcnt>
      <AppHeader />
      <router-view />
    </SC_Appcnt>

    <MessengerWrapper />

    <PostModal />
  </SC_Application>
</template>

<script>
import { appLayoutOptions } from './app-layout.ts'

export default appLayoutOptions
</script>

