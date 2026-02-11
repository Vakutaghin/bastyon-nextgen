<template>
  <SC_HomeWork class='adj'>
    <SidebarLeft :collapsed='leftSidebarCollapsed' />
    <SC_HomeMainContent :class='{ "sidebar-right-hidden": !rightSidebarVisible }'>
      <ContentFeed
        :feedData='null'
        :loading='false'
        :error='null'
        :right-sidebar-visible='rightSidebarVisible'
        :left-sidebar-collapsed='leftSidebarCollapsed'
        @toggle-right-sidebar='rightSidebarVisible = !rightSidebarVisible'
        @toggle-left-sidebar='leftSidebarCollapsed = !leftSidebarCollapsed'
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
const LS_KEY_LEFT_SIDEBAR_COLLAPSED = 'bastyon_left_sidebar_collapsed'

function getInitialRightSidebarVisible(): boolean {
  if (typeof localStorage === 'undefined') return true
  const stored = localStorage.getItem(LS_KEY_RIGHT_SIDEBAR)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return true
}

function getInitialLeftSidebarCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return false
  const stored = localStorage.getItem(LS_KEY_LEFT_SIDEBAR_COLLAPSED)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return false
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
    const leftSidebarCollapsed = ref(getInitialLeftSidebarCollapsed())

    watch(rightSidebarVisible, (visible) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_KEY_RIGHT_SIDEBAR, String(visible))
      }
    }, { immediate: true })

    watch(leftSidebarCollapsed, (collapsed) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_KEY_LEFT_SIDEBAR_COLLAPSED, String(collapsed))
      }
    }, { immediate: true })

    return { rightSidebarVisible, leftSidebarCollapsed }
  }
})
</script>
