<template>
  <SC_LeftSidebar :class="{ collapsed }" data-testid="sidebar-left">
    <SC_LeftSidebarScroll :class="{ collapsed }">
      <SidebarTabs :collapsed="collapsed" />
      <!-- Блоки под разделами — в порядке из «Шапки и панелей»; в узкой панели их нет. -->
      <template v-if="!collapsed">
        <component :is="SIDEBAR_BLOCK_COMPONENTS[id]" v-for="id in sidebarBlocks" :key="id" />
      </template>
    </SC_LeftSidebarScroll>
    <!-- Прокручивается содержимое, а номер версии всегда виден внизу панели. -->
    <SC_LeftSidebarFooter :class="{ collapsed }">
      <AppVersionBadge :compact="collapsed" />
    </SC_LeftSidebarFooter>
  </SC_LeftSidebar>
</template>

<script setup lang="ts">
import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import { SIDEBAR_BLOCK_COMPONENTS } from '@/b-components/sidebar/sidebar-blocks'
import { useHeaderLayout } from '@/b-components/header/header-layout/layout-items'
import AppVersionBadge from '@/b-components/app-update/app-version-badge.vue'
import { SC_LeftSidebar, SC_LeftSidebarScroll, SC_LeftSidebarFooter } from './styled'

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })

const { sidebarBlocks } = useHeaderLayout()
</script>
