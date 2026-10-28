<template>
  <SC_Header ref="headerRef">
    <SC_Sections>
      <!-- Телефон: логотип, за ним меню и «Назад» — одной группой слева; на
           компьютере обе стрелки у поиска, как у адресной строки. Группа — один
           элемент шапки: иначе space-between разносил бы их по ширине. -->
      <SC_Left v-if="mobile">
        <HeaderLogo compact />
        <SC_HamburgerButton :aria-label="t('header.menu')" @click="openDrawer">
          <MenuOutlined />
        </SC_HamburgerButton>
        <HeaderHistoryNav compact />
      </SC_Left>

      <HeaderLogo v-else />

      <HeaderHistoryNav v-if="!mobile" />
      <HeaderSearch v-if="!mobile" />

      <!-- Значки — в порядке из Настройки → «Шапка и меню». Песочные часы
           не настраиваются: появляются, только когда есть чего ждать, — у
           колокольчика, оба про события, а без него — с краю. -->
      <SC_Right v-hide-zero-width>
        <HeaderEvents v-if="!rightItems.includes('notifications')" />
        <template v-for="id in rightItems" :key="id">
          <HeaderServices v-if="id === 'services'" />
          <HeaderTor v-else-if="id === 'tor'" />
          <HeaderIpfs v-else-if="id === 'ipfs'" />
          <template v-else-if="id === 'notifications'">
            <HeaderEvents />
            <HeaderNotifications />
          </template>
          <HeaderReportBug v-else-if="id === 'reportBug'" />
          <SC_MessengerWrapper
            v-else-if="id === 'messenger' && showMessengerIcon"
            role="button"
            tabindex="0"
            :aria-label="t('bottomNav.messenger')"
            @click="toggleMessenger"
            @keydown.enter="toggleMessenger"
          >
            <MessageOutlined :style="ICON_SIZE_XL" />
            <SC_UnreadBadge v-if="!isFullScreen && unreadBadge">
              {{ unreadBadge }}
            </SC_UnreadBadge>
          </SC_MessengerWrapper>
          <HeaderThemeToggle v-else-if="id === 'theme'" />
          <HeaderWidthToggle v-else-if="id === 'pageWidth'" />
        </template>

        <HeaderUser />
      </SC_Right>
    </SC_Sections>
  </SC_Header>

  <!-- Шапка уехала вверх — строка состояния телефона остаётся на фоне
       приложения, а не на ленте, проезжающей под её значками. -->
  <SC_StatusBarShield v-if="autohide" />

  <MobileNavDrawer :is-open="drawerOpen" @close="closeDrawer" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { MessageOutlined, MenuOutlined } from '@/components/icons'
import HeaderLogo from '@/b-components/header/header-logo/header-logo.vue'
import HeaderHistoryNav from '@/b-components/header/header-history-nav/header-history-nav.vue'
import HeaderSearch from '@/b-components/header/header-search/header-search.vue'
import HeaderUser from '@/b-components/header/header-user/header-user.vue'
import HeaderEvents from '@/b-components/header/header-events/header-events.vue'
import HeaderNotifications from '@/b-components/header/header-notifications/header-notifications.vue'
import HeaderTor from '@/b-components/header/header-tor/header-tor.vue'
import HeaderIpfs from '@/b-components/header/header-ipfs/header-ipfs.vue'
import HeaderReportBug from '@/b-components/header/header-report-bug/header-report-bug.vue'
import HeaderServices from '@/b-components/header/header-services/header-services.vue'
import HeaderThemeToggle from '@/b-components/header/header-theme-toggle/header-theme-toggle.vue'
import HeaderWidthToggle from '@/b-components/header/header-width-toggle/header-width-toggle.vue'
import { MobileNavDrawer } from '@/b-components/mobile-nav-drawer'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'
import { useHeaderAutohide } from '@/composables/use-header-autohide'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import type { HeaderItemId } from '@/stores/header-layout'
import {
  PHONE_HEADER_ITEMS,
  useHeaderLayout,
} from '@/b-components/header/header-layout/layout-items'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import { vHideZeroWidth } from './hide-zero-width'
import {
  SC_Header,
  SC_Sections,
  SC_Right,
  SC_MessengerWrapper,
  SC_UnreadBadge,
  SC_HamburgerButton,
  SC_Left,
  SC_StatusBarShield,
} from './styled'

const { t } = useI18n()

const messengerStore = useMessengerStore()
const authStore = useAuthStore()
const { isFullScreen, totalUnreadCount } = storeToRefs(messengerStore)
const { isMobileOrTablet: mobile, shell } = useViewport()

// Телефон стоя: шапка уезжает при прокрутке вниз. Боком под ней колонка
// разделов, которая без шапки повисла бы с пустотой сверху.
const autohide = computed<boolean>(() => shell.value === 'compact')
const headerRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
useHeaderAutohide(() => {
  const r = headerRef.value
  return r instanceof HTMLElement ? r : (r?.$el ?? null)
}, autohide)

const drawerOpen = ref(false)

function toggleMessenger(): void {
  if (!authStore.isUserAuthenticated) return
  messengerStore.isFullScreen = !messengerStore.isFullScreen
}

function openDrawer(): void {
  drawerOpen.value = true
}

function closeDrawer(): void {
  drawerOpen.value = false
}

// Телефону — только то, что помещается в тесную шапку, в том же порядке.
const { headerItems } = useHeaderLayout()
const rightItems = computed<HeaderItemId[]>(() =>
  mobile.value
    ? headerItems.value.filter((id) => PHONE_HEADER_ITEMS.includes(id))
    : headerItems.value
)

/** Иконка чата в хедере — на компьютере, рядом с плавающей кнопкой. На телефоне
 *  и планшете чаты открывает пункт нижней панели, а в тесной шапке второй такой
 *  же вход только отнимал место. */
const prefs = useAppPreferencesStore()
const showMessengerIcon = computed<boolean>(
  () => authStore.isUserAuthenticated && prefs.messengerEnabled && !mobile.value
)

const unreadBadge = computed<string>(() => {
  const n = totalUnreadCount.value
  if (!n || n <= 0) return ''
  return n > 99 ? '99+' : String(n)
})
</script>
