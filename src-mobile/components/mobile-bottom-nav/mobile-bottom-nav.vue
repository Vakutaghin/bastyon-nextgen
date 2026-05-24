<template>
  <SC_MobileBottomNav>
    <SC_MobileBottomNavItem
      v-for='item in items'
      :key='item.path'
      :active='isActive(item.path)'
      @click.prevent='go(item.path)'
    >
      <component :is='item.icon' />
      <SC_MobileBottomNavLabel>{{ item.label }}</SC_MobileBottomNavLabel>
    </SC_MobileBottomNavItem>
  </SC_MobileBottomNav>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeOutlined,
  PlayCircleOutlined,
  WalletOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import {
  SC_MobileBottomNav,
  SC_MobileBottomNavItem,
  SC_MobileBottomNavLabel,
} from './styled'

const route = useRoute()
const router = useRouter()

const items = [
  { path: '/', label: 'Лента', icon: HomeOutlined },
  { path: '/my-videos', label: 'Видео', icon: PlayCircleOutlined },
  { path: '/wallets', label: 'Кошелёк', icon: WalletOutlined },
  { path: '/settings', label: 'Настройки', icon: SettingOutlined },
]

const currentPath = computed(() => route.path)

function isActive(path: string): boolean {
  if (path === '/') return currentPath.value === '/'
  return currentPath.value.startsWith(path)
}

function go(path: string) {
  if (currentPath.value !== path) router.push(path)
}
</script>
