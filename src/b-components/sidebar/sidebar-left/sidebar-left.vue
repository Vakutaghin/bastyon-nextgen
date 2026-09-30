<template>
  <SC_LeftSidebar :class="{ collapsed }">
    <SC_LeftSidebarScroll :class="{ collapsed }">
      <SidebarTabs :collapsed="collapsed" />
      <SidebarCategories v-if="!collapsed" />
      <SidebarTags v-if="!collapsed" />
    </SC_LeftSidebarScroll>
    <!-- Прокручивается содержимое, а номер версии всегда виден внизу панели. -->
    <SC_LeftSidebarFooter :class="{ collapsed }">
      <AppVersionBadge :compact="collapsed" />
    </SC_LeftSidebarFooter>
  </SC_LeftSidebar>
</template>

<script setup lang="ts">
import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import SidebarCategories from '@/b-components/sidebar/sidebar-categories/sidebar-categories.vue'
import SidebarTags from '@/b-components/sidebar/sidebar-tags/sidebar-tags.vue'
import AppVersionBadge from '@/b-components/app-update/app-version-badge.vue'
import { SC_LeftSidebar, SC_LeftSidebarScroll, SC_LeftSidebarFooter } from './styled'

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
</script>
