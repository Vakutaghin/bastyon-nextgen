<template>
  <SC_BottomNav>
    <SC_NavItem
      v-for="item in items"
      :key="item.key"
      :active="item.active"
      type="button"
      :aria-label="item.label"
      @click="item.onClick"
    >
      <SC_NavIcon>
        <component :is="item.icon" />
        <SC_NavBadge v-if="item.badge">{{ item.badge > 99 ? '99+' : item.badge }}</SC_NavBadge>
      </SC_NavIcon>
      <SC_NavLabel>{{ item.label }}</SC_NavLabel>
    </SC_NavItem>
  </SC_BottomNav>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  HomeOutlined,
  SearchOutlined,
  AppstoreOutlined,
  MessageOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue'
import { useMessengerStore } from '@/b-components/messenger/store'
import { SC_BottomNav, SC_NavItem, SC_NavIcon, SC_NavLabel, SC_NavBadge } from './bottom-nav.styled'

interface NavItem {
  key: string
  label: string
  icon: Component
  active: boolean
  badge?: number
  onClick: () => void
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const messengerStore = useMessengerStore()
const { isFullScreen, totalUnreadCount } = storeToRefs(messengerStore)

function go(path: string): void {
  if (route.path !== path) void router.push(path)
}

const items = computed<NavItem[]>(() => [
  {
    key: 'home',
    label: t('bottomNav.home'),
    icon: HomeOutlined,
    active: route.path === '/' && !isFullScreen.value,
    onClick: () => go('/'),
  },
  {
    key: 'search',
    label: t('bottomNav.search'),
    icon: SearchOutlined,
    active: route.path === '/search' && !isFullScreen.value,
    onClick: () => go('/search'),
  },
  {
    key: 'apps',
    label: t('bottomNav.apps'),
    icon: AppstoreOutlined,
    active: (route.path === '/miniapps' || route.path.startsWith('/app/')) && !isFullScreen.value,
    onClick: () => go('/miniapps'),
  },
  {
    key: 'messenger',
    label: t('bottomNav.messenger'),
    icon: MessageOutlined,
    active: isFullScreen.value,
    badge: totalUnreadCount.value,
    onClick: () => {
      messengerStore.isFullScreen = !messengerStore.isFullScreen
    },
  },
  {
    key: 'wallet',
    label: t('bottomNav.wallet'),
    icon: WalletOutlined,
    active: route.path === '/wallets' && !isFullScreen.value,
    onClick: () => go('/wallets'),
  },
])
</script>
