// Блоки левой панели под разделами — в порядке и с видимостью из «Шапки и
// панелей» (stores/header-layout). Тот же набор — в боковом меню телефона.

import type { Component } from 'vue'

import { useFiltersStore } from '@/stores/filters-store'
import type { SidebarBlockId } from '@/stores/header-layout'
import { useUIStore } from '@/stores/ui-store'
import SidebarCategories from './sidebar-categories/sidebar-categories.vue'
import SidebarFeedSettings from './sidebar-feed-settings/sidebar-feed-settings.vue'
import SidebarTags from './sidebar-tags/sidebar-tags.vue'

export const SIDEBAR_BLOCK_COMPONENTS: Record<SidebarBlockId, Component> = {
  feedSettings: SidebarFeedSettings,
  categories: SidebarCategories,
  tags: SidebarTags,
}

/**
 * Скрытый блок не действует: выбранное в нём сбрасывается. Иначе лента так и
 * осталась бы отобранной по категории, которой на экране больше нет, и
 * снять отбор было бы негде.
 */
export function resetSidebarBlock(id: SidebarBlockId): void {
  const filters = useFiltersStore()
  switch (id) {
    case 'feedSettings':
      if (filters.topFirst) filters.toggleTopFirst()
      useUIStore().setFeedLanguage(null)
      break
    case 'categories':
      if (filters.selectedCategories.length > 0) filters.clearCategorySelection()
      break
    case 'tags':
      if (filters.selectedTags.length > 0) filters.clearTagSelection()
      break
  }
}
