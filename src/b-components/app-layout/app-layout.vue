<template>
  <SC_Application id="application" class="menu-hide">
    <SC_Camera id="camera" />
    <StarExplosion />

    <SC_Appcnt>
      <AppHeader />
      <router-view />
    </SC_Appcnt>

    <MessengerWrapper />

    <PostModal />

    <WhatsNewModal />
  </SC_Application>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/b-components/header/app-header/app-header.vue'
import MessengerWrapper from '@/b-components/messenger/components/messenger-wrapper/messenger-wrapper.vue'
import PostModal from '@/b-components/content/post-modal/post-modal.vue'
import WhatsNewModal from '@/b-components/changelog/whats-new-modal.vue'
import { StarExplosion } from '@/b-components/effects/star-explosion'
import { useUIStore } from '@/stores/ui-store'
import { SC_Application, SC_Camera, SC_Appcnt } from './styled'

const uiStore = useUIStore()

onMounted(() => {
  void uiStore.loadLanguage()
})
</script>
