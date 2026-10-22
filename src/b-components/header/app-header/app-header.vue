<template>
  <SC_Header>
    <SC_Sections>
      <!-- «Назад» на телефоне — вплотную за меню; на компьютере обе стрелки у
           поиска, как у адресной строки. Группа — один элемент шапки: иначе
           space-between ставил бы стрелку посередине между меню и логотипом. -->
      <SC_Left v-if="mobile">
        <SC_HamburgerButton :aria-label="t('header.menu')" @click="openDrawer">
          <MenuOutlined />
        </SC_HamburgerButton>
        <HeaderHistoryNav compact />
      </SC_Left>

      <HeaderLogo />

      <HeaderHistoryNav v-if="!mobile" />
      <HeaderSearch v-if="!mobile" />

      <SC_Right v-hide-zero-width>
        <HeaderServices v-if="!mobile" />
        <HeaderTor v-if="!mobile" />
        <HeaderIpfs v-if="!mobile" />
        <!-- Ожидание блокчейна видно и на телефоне: часы появляются, только когда есть чего ждать. -->
        <HeaderEvents />
        <HeaderNotifications />
        <HeaderReportBug v-if="!mobile" />
        <SC_MessengerWrapper v-if="showMessengerIcon" @click="toggleMessenger">
          <MessageOutlined :style="ICON_SIZE_XL" />
          <SC_UnreadBadge v-if="!isFullScreen && unreadBadge">
            {{ unreadBadge }}
          </SC_UnreadBadge>
        </SC_MessengerWrapper>

        <HeaderThemeToggle />

        <HeaderUser />
      </SC_Right>
    </SC_Sections>
  </SC_Header>

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
import { MobileNavDrawer } from '@/b-components/mobile-nav-drawer'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
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
} from './styled'

const { t } = useI18n()

const messengerStore = useMessengerStore()
const authStore = useAuthStore()
const { isFullScreen, totalUnreadCount } = storeToRefs(messengerStore)
const { isMobileOrTablet: mobile } = useViewport()

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
