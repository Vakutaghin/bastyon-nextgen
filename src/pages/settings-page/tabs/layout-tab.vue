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
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHeaderLayoutStore } from '@/stores/header-layout-store'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import type { HeaderItemId, MenuItemId } from '@/stores/header-layout'
import {
  HEADER_ITEMS,
  MENU_ITEMS,
  isLockedMenuItem,
  unavailableReason,
} from '@/b-components/header/header-layout/layout-items'
import LayoutEditor from './layout-editor.vue'
import { SC_LayoutHint } from './layout-editor.styled'
import { SC_SettingsSectionTitle } from '../settings-page.styled'

const { t } = useI18n()
const layout = useHeaderLayoutStore()
void layout.ensureLoaded()
const prefs = useAppPreferencesStore()

function reasonOf(id: string): string | null {
  return unavailableReason(id as HeaderItemId | MenuItemId, prefs.messengerEnabled)
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
</script>
