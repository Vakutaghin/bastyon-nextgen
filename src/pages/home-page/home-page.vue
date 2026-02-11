<template>
  <SC_HomeWork class='adj'>
    <SidebarLeft />
    <SC_HomeMainContent :class='{ "sidebar-right-hidden": !rightSidebarVisible }'>
      <ContentFeed
        :feedData='null'
        :loading='false'
        :error='null'
        :right-sidebar-visible='rightSidebarVisible'
        @toggle-right-sidebar='rightSidebarVisible = !rightSidebarVisible'
      />
    </SC_HomeMainContent>
    <SidebarRight v-if='rightSidebarVisible' />
  </SC_HomeWork>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import SidebarLeft from '@/b-components/sidebar/sidebar-left/sidebar-left.vue'
import SidebarRight from '@/b-components/sidebar/sidebar-right/sidebar-right.vue'
import ContentFeed from '@/b-components/content/content-feed/content-feed.vue'
import { SC_HomeWork, SC_HomeMainContent } from './home-page.styled'

const LS_KEY_RIGHT_SIDEBAR = 'bastyon_right_sidebar_visible'

function getInitialRightSidebarVisible(): boolean {
  if (typeof localStorage === 'undefined') return true
  const stored = localStorage.getItem(LS_KEY_RIGHT_SIDEBAR)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return true
}

export default defineComponent({
  name: 'HomeView',
  components: {
    SidebarLeft,
    SidebarRight,
    ContentFeed,
    SC_HomeWork,
    SC_HomeMainContent
  },
  setup() {
    const rightSidebarVisible = ref(getInitialRightSidebarVisible())

    watch(rightSidebarVisible, (visible) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_KEY_RIGHT_SIDEBAR, String(visible))
      }
    }, { immediate: true })

    return { rightSidebarVisible }
  }
})
</script>
