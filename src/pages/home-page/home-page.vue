<template>
  <SC_HomeWork class="adj" :class="{ 'is-mobile': mobile }">
    <h1 class="visually-hidden">{{ t('misc.bastyonFeed') }}</h1>
    <SidebarLeft v-if="!mobile" :collapsed="leftSidebarCollapsed" />
    <SC_HomeMainContent :class="{ 'sidebar-right-hidden': !rightSidebarVisible || mobile }">
      <ContentFeed
        :feed-data="null"
        :loading="false"
        :error="null"
        :right-sidebar-visible="!mobile && rightSidebarVisible"
        :left-sidebar-collapsed="leftSidebarCollapsed"
        @toggle-right-sidebar="rightSidebarVisible = !rightSidebarVisible"
        @toggle-left-sidebar="leftSidebarCollapsed = !leftSidebarCollapsed"
      />
    </SC_HomeMainContent>
    <SidebarRight v-if="!mobile && rightSidebarVisible" />
  </SC_HomeWork>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SidebarLeft from '@/b-components/sidebar/sidebar-left/sidebar-left.vue'
import SidebarRight from '@/b-components/sidebar/sidebar-right/sidebar-right.vue'
import ContentFeed from '@/b-components/content/content-feed/content-feed.vue'
import { settingsAPI } from '@/db/apis/settings-api'
import { isMobile } from '@mobile/utils/platform'
import { SC_HomeWork, SC_HomeMainContent } from './home-page.styled'

const { t } = useI18n()

const SETTING_KEY_RIGHT_SIDEBAR = 'bastyonRightSidebarVisible'
const SETTING_KEY_LEFT_SIDEBAR_COLLAPSED = 'bastyonLeftSidebarCollapsed'

const rightSidebarVisible = ref(true)
const leftSidebarCollapsed = ref(false)
const mobile = computed(() => isMobile())

async function loadSidebarSettings(): Promise<void> {
  try {
    const [right, left] = await Promise.all([
      settingsAPI.get(SETTING_KEY_RIGHT_SIDEBAR),
      settingsAPI.get(SETTING_KEY_LEFT_SIDEBAR_COLLAPSED),
    ])
    if (right !== undefined) {
      rightSidebarVisible.value = right === true
    } else if (typeof localStorage !== 'undefined') {
      // Миграция со старого localStorage-ключа — переносим в IndexedDB.
      const stored = localStorage.getItem('bastyon_right_sidebar_visible')
      if (stored === 'true' || stored === 'false') {
        const val = stored === 'true'
        rightSidebarVisible.value = val
        await settingsAPI.set(SETTING_KEY_RIGHT_SIDEBAR, val)
        localStorage.removeItem('bastyon_right_sidebar_visible')
      }
    }
    if (left !== undefined) {
      leftSidebarCollapsed.value = left === true
    } else if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('bastyon_left_sidebar_collapsed')
      if (stored === 'true' || stored === 'false') {
        const val = stored === 'true'
        leftSidebarCollapsed.value = val
        await settingsAPI.set(SETTING_KEY_LEFT_SIDEBAR_COLLAPSED, val)
        localStorage.removeItem('bastyon_left_sidebar_collapsed')
      }
    }
  } catch (e) {
    console.error('Failed to load sidebar settings:', e)
  }
}

onMounted(loadSidebarSettings)

watch(rightSidebarVisible, (visible) => {
  settingsAPI
    .set(SETTING_KEY_RIGHT_SIDEBAR, visible)
    .catch((e) => console.error('Failed to save right sidebar setting:', e))
})

watch(leftSidebarCollapsed, (collapsed) => {
  settingsAPI
    .set(SETTING_KEY_LEFT_SIDEBAR_COLLAPSED, collapsed)
    .catch((e) => console.error('Failed to save left sidebar setting:', e))
})
</script>
