<template>
  <SC_Header>
    <SC_Sections>
      <SC_HamburgerButton :aria-label="t('header.menu')" @click="openDrawer">
        <MenuOutlined />
      </SC_HamburgerButton>

      <HeaderLogo />

      <HeaderSearch v-if="!mobile" />

      <SC_Right v-hide-zero-width>
        <SC_CreatePostButton
          v-if="showCreatePost"
          :aria-label="t('postComposer.title')"
          @click="openComposer"
        >
          <PlusOutlined />
        </SC_CreatePostButton>
        <HeaderTor v-if="!mobile" />
        <HeaderEvents v-if="!mobile" />
        <HeaderNotifications />
        <HeaderReportBug v-if="!mobile" />
        <SC_MessengerWrapper v-if="showMessengerIcon" @click="toggleMessenger">
          <CloseOutlined v-if="isFullScreen" :style="ICON_SIZE_XL" />
          <MessageOutlined v-else :style="ICON_SIZE_XL" />
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
import { computed, ref, type Directive } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { MessageOutlined, CloseOutlined, MenuOutlined, PlusOutlined } from '@ant-design/icons-vue'
import HeaderLogo from '@/b-components/header/header-logo/header-logo.vue'
import HeaderSearch from '@/b-components/header/header-search/header-search.vue'
import HeaderUser from '@/b-components/header/header-user/header-user.vue'
import HeaderEvents from '@/b-components/header/header-events/header-events.vue'
import HeaderNotifications from '@/b-components/header/header-notifications/header-notifications.vue'
import HeaderTor from '@/b-components/header/header-tor/header-tor.vue'
import HeaderReportBug from '@/b-components/header/header-report-bug/header-report-bug.vue'
import HeaderThemeToggle from '@/b-components/header/header-theme-toggle/header-theme-toggle.vue'
import { MobileNavDrawer } from '@/b-components/mobile-nav-drawer'
import { useMessengerStore } from '@/b-components/messenger/store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'
import { useModalStore } from '@/stores'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import {
  SC_Header,
  SC_Sections,
  SC_Right,
  SC_MessengerWrapper,
  SC_CreatePostButton,
  SC_UnreadBadge,
  SC_HamburgerButton,
} from './styled'

const { t } = useI18n()

const messengerStore = useMessengerStore()
const authStore = useAuthStore()
const modalStore = useModalStore()
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

/** Иконка чата в хедере всегда видна авторизованному пользователю —
 *  на десктопе это альтернатива floating-кнопке, на мобилке единственный способ. */
const showMessengerIcon = computed<boolean>(() => authStore.isUserAuthenticated)

/** Кнопка создания поста — только для авторизованных. */
const showCreatePost = computed<boolean>(() => authStore.isUserAuthenticated)

function openComposer(): void {
  modalStore.openPostComposerModal()
}

const unreadBadge = computed<string>(() => {
  const n = totalUnreadCount.value
  if (!n || n <= 0) return ''
  return n > 99 ? '99+' : String(n)
})

/**
 * Прячет дочерние элементы, схлопнутые до 0px по горизонтали. Нужно для адаптива:
 * иконки в `<SC_Right>` могут визуально пропадать на узких экранах из-за стилей
 * выше по каскаду — директива скрывает их через `display:none`, чтобы соседи
 * не «прыгали» из-за невидимых occupants.
 */
const vHideZeroWidth: Directive<HTMLElement> = {
  mounted(el) {
    const checkWidth = (): void => {
      const children = Array.from(el.children) as HTMLElement[]
      for (const child of children) {
        const rect = child.getBoundingClientRect()
        child.style.display = rect.width === 0 ? 'none' : ''
      }
    }

    checkWidth()

    const resizeObserver = new ResizeObserver(checkWidth)
    resizeObserver.observe(el)
    for (const child of Array.from(el.children) as HTMLElement[]) {
      resizeObserver.observe(child)
    }

    ;(el as HTMLElement & { _resizeObserver?: ResizeObserver })._resizeObserver = resizeObserver
  },
  unmounted(el) {
    const observer = (el as HTMLElement & { _resizeObserver?: ResizeObserver })._resizeObserver
    observer?.disconnect()
  },
}
</script>
