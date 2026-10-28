<template>
  <SC_SettingsSectionTitle>{{ t('settings.layout.headerTitle') }}</SC_SettingsSectionTitle>
  <SC_LayoutHint>{{ t('settings.layout.headerHint') }}</SC_LayoutHint>
  <LayoutEditor
    :title="t('settings.layout.headerTitle')"
    :entries="layout.headerLayout"
    :items="HEADER_ITEMS"
    :reason-of="reasonOf"
    :note-of="headerNote"
    :customized="layout.customized.header"
    data-testid="layout-header"
    @toggle="(id, visible) => layout.setVisible('header', id, visible)"
    @move="(from, to) => layout.move('header', from, to)"
    @reset="layout.reset('header')"
  />

  <SC_SettingsSectionTitle>{{ t('settings.layout.menuTitle') }}</SC_SettingsSectionTitle>
  <SC_LayoutHint>{{ t('settings.layout.menuHint') }}</SC_LayoutHint>
  <LayoutEditor
    :title="t('settings.layout.menuTitle')"
    :entries="layout.menuLayout"
    :items="MENU_ITEMS"
    :reason-of="reasonOf"
    :note-of="menuNote"
    :locked-of="(id) => isLockedMenuItem(id as MenuItemId)"
    :customized="layout.customized.menu"
    data-testid="layout-menu"
    @toggle="(id, visible) => layout.setVisible('menu', id, visible)"
    @move="(from, to) => layout.move('menu', from, to)"
    @reset="layout.reset('menu')"
  />

  <SC_SettingsSectionTitle>{{ t('settings.layout.sidebarTitle') }}</SC_SettingsSectionTitle>
  <SC_LayoutHint>{{ t('settings.layout.sidebarHint') }}</SC_LayoutHint>
  <LayoutEditor
    :title="t('settings.layout.sidebarTitle')"
    :entries="layout.sidebarLayout"
    :items="SIDEBAR_ITEMS"
    :reason-of="reasonOf"
    :note-of="sidebarNote"
    :customized="layout.customized.sidebar"
    data-testid="layout-sidebar"
    @toggle="(id, visible) => layout.setVisible('sidebar', id, visible)"
    @move="(from, to) => layout.move('sidebar', from, to)"
    @reset="layout.reset('sidebar')"
  />

  <SC_SettingsSectionTitle>{{ t('settings.layout.blocksTitle') }}</SC_SettingsSectionTitle>
  <SC_LayoutHint>{{ t('settings.layout.blocksHint') }}</SC_LayoutHint>
  <LayoutEditor
    :title="t('settings.layout.blocksTitle')"
    :entries="layout.blocksLayout"
    :items="SIDEBAR_BLOCKS"
    :reason-of="reasonOf"
    :note-of="blockNote"
    :customized="layout.customized.blocks"
    data-testid="layout-blocks"
    @toggle="toggleBlock"
    @move="(from, to) => layout.move('blocks', from, to)"
    @reset="layout.reset('blocks')"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHeaderLayoutStore } from '@/stores/header-layout-store'
import type {
  HeaderItemId,
  MenuItemId,
  SidebarBlockId,
  SidebarItemId,
} from '@/stores/header-layout'
import {
  HEADER_ITEMS,
  MENU_ITEMS,
  SIDEBAR_BLOCKS,
  SIDEBAR_ITEMS,
  isLockedMenuItem,
  unavailableReason,
} from '@/b-components/header/header-layout/layout-items'
import { resetSidebarBlock } from '@/b-components/sidebar/sidebar-blocks'
import LayoutEditor from './layout-editor.vue'
import { SC_LayoutHint } from './layout-editor.styled'
import { SC_SettingsSectionTitle } from '../settings-page.styled'

const { t } = useI18n()
const layout = useHeaderLayoutStore()
void layout.ensureLoaded()

function reasonOf(id: string): string | null {
  return unavailableReason(id as HeaderItemId | MenuItemId | SidebarItemId | SidebarBlockId)
}

/**
 * Что значит убрать значок. Колокольчик — только значок: уведомления
 * всплывают и без него. Tor и IPFS включают и выключают только в их значках —
 * скрытые, они работают как были, но управлять ими станет неоткуда.
 */
function headerNote(id: string): string | null {
  switch (id as HeaderItemId) {
    case 'notifications':
      return 'settings.layout.noteNotifications'
    case 'tor':
    case 'ipfs':
      return 'settings.layout.noteNodeControls'
    case 'messenger':
      return 'settings.layout.noteMessenger'
    default:
      return null
  }
}

function menuNote(id: string): string | null {
  return isLockedMenuItem(id as MenuItemId) ? 'settings.layout.locked' : null
}

/** Без «Ленты» в панели на ленту ведёт логотип. */
function sidebarNote(id: string): string | null {
  return (id as SidebarItemId) === 'feed' ? 'settings.layout.noteFeed' : null
}

/** Что сбросится, если блок скрыть (sidebar-blocks). */
function blockNote(id: string): string | null {
  switch (id as SidebarBlockId) {
    case 'feedSettings':
      return 'settings.layout.noteFeedSettings'
    case 'categories':
      return 'settings.layout.noteCategories'
    case 'tags':
      return 'settings.layout.noteTags'
    default:
      return null
  }
}

async function toggleBlock(id: string, visible: boolean): Promise<void> {
  await layout.setVisible('blocks', id, visible)
  if (!visible) resetSidebarBlock(id as SidebarBlockId)
}
</script>
