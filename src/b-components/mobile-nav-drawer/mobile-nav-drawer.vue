<template>
  <Teleport to="body">
    <SC_Backdrop :isOpen="isOpen" @click="close" />
    <!-- data-popup-host: списки полей (язык ленты) открываются внутри меню, а не под ним. -->
    <SC_Drawer :isOpen="isOpen" :aria-hidden="!isOpen" data-popup-host @click.stop>
      <SC_DrawerHeader>
        <!-- Под названием — номер версии с проверкой обновлений: левой панели
             компьютера, где он стоит внизу, на телефоне нет. -->
        <SC_DrawerBrand>
          <SC_DrawerTitle>{{ t('app.name') }}</SC_DrawerTitle>
          <AppVersionBadge />
        </SC_DrawerBrand>
        <SC_DrawerClose :aria-label="t('sidebar.close')" @click="close">
          <CloseOutlined :style="ICON_SIZE_LG" />
        </SC_DrawerClose>
      </SC_DrawerHeader>

      <!-- Содержимое монтируется при первом открытии: теги и категории грузятся
           с ноды, и на телефоне незачем делать это при каждом запуске. -->
      <template v-if="everOpened">
        <!-- Без аккаунта часть разделов закрыта — вход и регистрация сразу наверху. -->
        <SC_DrawerAuth v-if="!isAuthenticated">
          <Button type="primary" block @click="openAuth('login')">
            {{ t('header.signIn') }}
          </Button>
          <Button block @click="openAuth('register')">{{ t('header.register') }}</Button>
        </SC_DrawerAuth>

        <!-- Та же панель, что слева на компьютере: режимы ленты, мини-приложения,
             эксплорер, справка и закреплённые приложения. -->
        <SC_DrawerPanel>
          <SC_DrawerSectionTitle>{{ t('sidebar.navigation') }}</SC_DrawerSectionTitle>
          <SidebarTabs />
        </SC_DrawerPanel>

        <!-- Разделы из меню аккаунта в шапке компьютера — такими же пунктами. -->
        <SC_DrawerPanel v-if="isAuthenticated">
          <SC_DrawerSectionTitle>{{ t('sidebar.account') }}</SC_DrawerSectionTitle>
          <SC_Tabs>
            <SC_TabsItem
              v-for="item in accountItems"
              :key="item.id"
              :active="!!item.path && isActive(item.path)"
              :disabled="false"
              type="button"
              @click="openItem(item)"
            >
              <component :is="item.icon" />
              <SC_TabsLabel>{{ item.label }}</SC_TabsLabel>
            </SC_TabsItem>
          </SC_Tabs>
        </SC_DrawerPanel>

        <SC_DrawerPanel v-if="sidebarBlocks.length > 0">
          <component :is="SIDEBAR_BLOCK_COMPONENTS[id]" v-for="id in sidebarBlocks" :key="id" />
        </SC_DrawerPanel>
      </template>
    </SC_Drawer>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/button/button.vue'
import { ICON_SIZE_LG } from '@/styles/icon-styles'
import { closePageOverlay, openPageOverlay } from '@/composables/use-page-overlay'
import { useAuthStore } from '@/blockchain'
import { useModalStore } from '@/stores/modal-store'
import { useFiltersStore } from '@/stores/filters-store'
import { useUIStore } from '@/stores/ui-store'
import type { MenuItemId } from '@/stores/header-layout'
import {
  MENU_ITEMS,
  MENU_ITEM_PATHS,
  useHeaderLayout,
} from '@/b-components/header/header-layout/layout-items'
import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import { SIDEBAR_BLOCK_COMPONENTS } from '@/b-components/sidebar/sidebar-blocks'
import AppVersionBadge from '@/b-components/app-update/app-version-badge.vue'
import { SC_Tabs, SC_TabsItem, SC_TabsLabel } from '@/b-components/sidebar/sidebar-tabs/styled'
import { CloseOutlined } from '@/components/icons'
import {
  SC_Backdrop,
  SC_Drawer,
  SC_DrawerHeader,
  SC_DrawerBrand,
  SC_DrawerTitle,
  SC_DrawerClose,
  SC_DrawerAuth,
  SC_DrawerPanel,
  SC_DrawerSectionTitle,
} from './styled'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const modalStore = useModalStore()
const filtersStore = useFiltersStore()
const uiStore = useUIStore()

const isAuthenticated = computed(() => authStore.isUserAuthenticated)

const profileLink = computed<string>(() => {
  const name = authStore.getUserProfile?.name
  if (name) return '/' + name.toLowerCase()
  const address = authStore.getUserAddress
  return address ? '/' + address : '/'
})

// Те же пункты и порядок, что в меню аккаунта на компьютере (Настройки →
// «Шапка и меню»), без «Справки»: она уже есть в разделах выше.
const { menuItems, sidebarBlocks } = useHeaderLayout()
const accountItems = computed(() =>
  menuItems.value
    .filter((id) => id !== 'help')
    .map((id) => ({
      id,
      path: id === 'profile' ? profileLink.value : MENU_ITEM_PATHS[id],
      label: t(MENU_ITEMS[id].labelKey!),
      icon: MENU_ITEMS[id].icon,
    }))
)

const everOpened = ref(false)

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

function close() {
  emit('close')
}

function openItem(item: { id: MenuItemId; path?: string }): void {
  if (item.path) {
    go(item.path)
    return
  }
  // «Сообщить об ошибке» — чат поддержки во весь экран.
  close()
  void import('@/b-components/header/header-report-bug/open-support-chat').then((m) =>
    m.openSupportChat()
  )
}

function go(path: string) {
  if (route.path !== path) void router.push(path)
  close()
}

function openAuth(mode: 'login' | 'register') {
  close()
  modalStore.openAuthModal(mode)
}

// Любой переход — пункт меню, вкладка, закреплённое приложение — закрывает меню.
watch(
  () => route.fullPath,
  () => {
    if (props.isOpen) close()
  }
)

// Окно входа (например, гость нажал «Подписки») открывается поверх страницы, не меню.
watch(
  () => modalStore.authModal.isOpen,
  (open) => {
    if (open && props.isOpen) close()
  }
)

// Категории, теги и язык ленты фильтруют ленту: выбранные на другой странице, они ведут на неё.
watch(
  () => [
    filtersStore.selectedCategories.join('|'),
    filtersStore.selectedTags.join('|'),
    filtersStore.topFirst,
    uiStore.feedLanguage,
  ],
  () => {
    if (props.isOpen && route.path !== '/') void router.push('/')
  }
)

// Пока меню открыто, страница под ним не скроллится. Через общий счётчик
// оверлеев: прямой `body.style.overflow = ''` при закрытии снимал блокировку,
// которую держал полноэкранный мессенджер (N36).
let lockHeld = false
watch(
  () => props.isOpen,
  (open) => {
    if (open) everOpened.value = true
    if (open && !lockHeld) {
      lockHeld = true
      openPageOverlay()
    } else if (!open && lockHeld) {
      lockHeld = false
      closePageOverlay()
    }
  }
)
onBeforeUnmount(() => {
  if (lockHeld) closePageOverlay()
})
</script>
