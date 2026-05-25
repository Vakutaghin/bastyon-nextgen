<template>
  <Teleport to="body">
    <SC_Backdrop :isOpen="isOpen" @click="close" />
    <SC_Drawer :isOpen="isOpen" @click.stop>
      <SC_DrawerHeader>
        <SC_DrawerTitle>Bastyon</SC_DrawerTitle>
        <SC_DrawerClose aria-label="Закрыть" @click="close">
          <CloseOutlined :style="{ fontSize: '18px' }" />
        </SC_DrawerClose>
      </SC_DrawerHeader>

      <SC_DrawerSection>
        <SC_DrawerSectionTitle>Навигация</SC_DrawerSectionTitle>
        <SC_DrawerItem
          v-for="item in items"
          :key="item.path"
          :active="isActive(item.path)"
          @click="go(item.path)"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </SC_DrawerItem>
      </SC_DrawerSection>
    </SC_Drawer>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeOutlined,
  PlayCircleOutlined,
  WalletOutlined,
  SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import {
  SC_Backdrop,
  SC_Drawer,
  SC_DrawerHeader,
  SC_DrawerTitle,
  SC_DrawerClose,
  SC_DrawerSection,
  SC_DrawerSectionTitle,
  SC_DrawerItem,
} from './styled'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

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

function close() {
  emit('close')
}

function go(path: string) {
  if (currentPath.value !== path) router.push(path)
  close()
}

// Lock body scroll while drawer is open.
watch(
  () => props.isOpen,
  (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
)
</script>
