<template>
  <Teleport to="body">
    <SC_Backdrop :isOpen="isOpen" @click="close" />
    <SC_Drawer :isOpen="isOpen" @click.stop>
      <SC_DrawerHeader>
        <SC_DrawerTitle>Bastyon</SC_DrawerTitle>
        <SC_DrawerClose :aria-label="t('sidebar.close')" @click="close">
          <CloseOutlined :style="ICON_SIZE_LG" />
        </SC_DrawerClose>
      </SC_DrawerHeader>

      <SC_DrawerSection>
        <SC_DrawerSectionTitle>{{ t('sidebar.navigation') }}</SC_DrawerSectionTitle>
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
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ICON_SIZE_LG } from '@/styles/icon-styles'
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
const { t } = useI18n()

const items = computed(() => [
  { path: '/', label: t('sidebar.feed'), icon: HomeOutlined },
  { path: '/my-videos', label: t('sidebar.video'), icon: PlayCircleOutlined },
  { path: '/wallets', label: t('sidebar.wallet'), icon: WalletOutlined },
  { path: '/settings', label: t('sidebar.settings'), icon: SettingOutlined },
])

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
