<template>
  <Teleport to="body">
    <SC_Backdrop :isOpen="isOpen" @click="close" />
    <SC_Drawer :isOpen="isOpen" :aria-hidden="!isOpen" @click.stop>
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
              :key="item.path"
              :active="isActive(item.path)"
              :disabled="false"
              type="button"
              @click="go(item.path)"
            >
              <component :is="item.icon" />
              <SC_TabsLabel>{{ item.label }}</SC_TabsLabel>
            </SC_TabsItem>
          </SC_Tabs>
        </SC_DrawerPanel>

        <SC_DrawerPanel>
          <SidebarCategories />
          <SidebarTags />
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
import { isTauriEnv } from '@/helpers/api/request-tor'
import { isRadioSupported } from '@/mesh/radio/platform'
import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import SidebarCategories from '@/b-components/sidebar/sidebar-categories/sidebar-categories.vue'
import SidebarTags from '@/b-components/sidebar/sidebar-tags/sidebar-tags.vue'
import AppVersionBadge from '@/b-components/app-update/app-version-badge.vue'
import { SC_Tabs, SC_TabsItem, SC_TabsLabel } from '@/b-components/sidebar/sidebar-tabs/styled'
import {
  CloseOutlined,
  FileOutlined,
  HourglassOutlined,
  PlayCircleOutlined,
  RadioTowerIcon,
  SettingOutlined,
  UserOutlined,
  WalletOutlined,
} from '@/components/icons'
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

const isAuthenticated = computed(() => authStore.isUserAuthenticated)

const profileLink = computed<string>(() => {
  const name = authStore.getUserProfile?.name
  if (name) return '/' + name.toLowerCase()
  const address = authStore.getUserAddress
  return address ? '/' + address : '/'
})

const accountItems = computed(() => [
  { path: profileLink.value, label: t('accountMsg.menuProfile'), icon: UserOutlined },
  { path: '/wallets', label: t('accountMsg.menuWallets'), icon: WalletOutlined },
  { path: '/limits', label: t('accountMsg.menuLimits'), icon: HourglassOutlined },
  { path: '/my-videos', label: t('accountMsg.menuMyVideos'), icon: PlayCircleOutlined },
  // Раздавать файлы через IPFS умеет только десктоп (своя нода Kubo); радио для
  // mesh-сетей подключается на десктопе и в Android.
  ...(isTauriEnv()
    ? [{ path: '/my-files', label: t('accountMsg.menuMyFiles'), icon: FileOutlined }]
    : []),
  ...(isRadioSupported()
    ? [{ path: '/mesh', label: t('accountMsg.menuMesh'), icon: RadioTowerIcon }]
    : []),
  { path: '/settings', label: t('accountMsg.menuSettings'), icon: SettingOutlined },
])

const everOpened = ref(false)

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

function close() {
  emit('close')
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

// Категории и теги фильтруют ленту: выбранные на другой странице, они ведут на неё.
watch(
  () => [
    filtersStore.selectedCategories.join('|'),
    filtersStore.selectedTags.join('|'),
    filtersStore.topFirst,
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
