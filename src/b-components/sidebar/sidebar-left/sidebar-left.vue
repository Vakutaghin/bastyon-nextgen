<template>
  <SC_LeftSidebar :class='{ collapsed }'>
    <SidebarTabs :collapsed='collapsed' />
    <SidebarCategories v-if='!collapsed' />
    <SidebarTags v-if='!collapsed' />
    <!-- <SidebarFooter /> -->
  </SC_LeftSidebar>
</template>

<script>
import { sidebarLeftOptions } from './sidebar-left.ts'

export default sidebarLeftOptions
</script>
