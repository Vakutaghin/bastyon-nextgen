<template>
  <SC_LeftSidebar :class="{ collapsed }">
    <SidebarTabs :collapsed="collapsed" />
    <SidebarCategories v-if="!collapsed" />
    <SidebarTags v-if="!collapsed" />
    <!-- <SidebarFooter /> -->
  </SC_LeftSidebar>
</template>

<script setup lang="ts">
import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import SidebarCategories from '@/b-components/sidebar/sidebar-categories/sidebar-categories.vue'
import SidebarTags from '@/b-components/sidebar/sidebar-tags/sidebar-tags.vue'
import { SC_LeftSidebar } from './styled'

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
</script>
