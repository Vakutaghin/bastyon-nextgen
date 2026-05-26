<template>
  <div>
    <SC_Tabs :class="{ collapsed }">
      <SC_TabsItem
        v-for="tab in tabsData"
        :key="tab.id"
        :active="tab.active"
        :disabled="tab.disabled"
        type="button"
        @click="!tab.disabled && selectTab(tab.id)"
      >
        <HomeOutlined v-if="tab.icon === 'HomeOutlined'" />
        <TeamOutlined v-else-if="tab.icon === 'TeamOutlined'" />
        <PlayCircleOutlined v-else-if="tab.icon === 'PlayCircleOutlined'" />
        <SoundOutlined v-else-if="tab.icon === 'SoundOutlined'" />
        <FileTextOutlined v-else-if="tab.icon === 'FileTextOutlined'" />
        <BookOutlined v-else-if="tab.icon === 'BookOutlined'" />
        <StarOutlined v-else-if="tab.icon === 'StarOutlined'" />
        <MessageOutlined v-else-if="tab.icon === 'MessageOutlined'" />
        <AppstoreOutlined v-else />
        <SC_TabsLabel v-if="!collapsed">{{ tab.name }}</SC_TabsLabel>
      </SC_TabsItem>
    </SC_Tabs>

    <!-- Закреплённые миниаппы (favorites) — управляются через звёздочки в каталоге -->
    <SidebarFavorites :collapsed="collapsed" />
  </div>
</template>

<script>
import { sidebarTabsOptions } from './sidebar-tabs.ts'
import SidebarFavorites from './sidebar-favorites.vue'

export default {
  ...sidebarTabsOptions,
  components: {
    ...sidebarTabsOptions.components,
    SidebarFavorites,
  },
}
</script>
