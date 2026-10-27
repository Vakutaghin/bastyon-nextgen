<template>
  <template v-if="isAuthenticated">
    <!-- На телефоне выпадашка не раскрывается: список открывается окном во
         весь экран (ниже). Выпадашка вылезала за край экрана, а прокрутка
         списка внутри неё цеплялась за страницу. -->
    <Dropdown
      :open="visible && !sheet"
      :trigger="['click']"
      placement="bottomRight"
      :get-popup-container="getPopupContainer"
      overlay-class-name="header-notifications-dropdown"
      :overlay-style="{ zIndex: 3000 }"
      @open-change="onOpenChange"
    >
      <SC_NotificationsWrapper role="button" tabindex="0" :aria-label="t('header.notifications')">
        <Badge
          :count="unreadCount"
          :offset="[0, 5]"
          :number-style="{ backgroundColor: 'var(--ui-primary)' }"
        >
          <BellOutlined :style="ICON_SIZE_XL" />
        </Badge>
      </SC_NotificationsWrapper>

      <template #overlay>
        <NotificationsPanel v-if="!sheet" :visible="visible" @close="onOpenChange(false)" />
      </template>
    </Dropdown>

    <Modal
      v-if="sheet"
      :open="visible"
      class="notifications-modal"
      :closable="false"
      :footer="null"
      @cancel="onOpenChange(false)"
    >
      <NotificationsPanel :visible="visible" sheet @close="onOpenChange(false)" />
    </Modal>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown, Badge } from 'ant-design-vue'
import { ICON_SIZE_XL } from '@/styles/icon-styles'
import { BellOutlined } from '@/components/icons'
import Modal from '@/components/modal/modal.vue'
import { useAuthStore, useNotificationsStore } from '@/stores'
import { useViewport } from '@/composables/use-viewport'
import NotificationsPanel from './notifications-panel.vue'
import { SC_NotificationsWrapper } from './styled'

const { t } = useI18n()

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const { isMobileOrTablet: sheet } = useViewport()

const isAuthenticated = computed<boolean>(() => authStore.isUserAuthenticated)

function runInit(): void {
  if (authStore.isUserAuthenticated && authStore.getUserAddress) {
    notificationsStore.init()
  }
}

onMounted(runInit)

watch(
  () => authStore.isUserAuthenticated && authStore.getUserAddress,
  (authenticated) => {
    if (authenticated) runInit()
  }
)

const visible = ref(false)

const unreadCount = computed(() => notificationsStore.unreadCount)

function onOpenChange(open: boolean): void {
  const wasOpen = visible.value
  visible.value = open
  if (open) {
    // Read-pointer НЕ двигаем на открытии: раньше это происходило синхронно, до
    // рендера, и подсветка «новых» не показывалась ни разу (S52). Двигаем на
    // закрытии — пользователь к этому моменту список действительно видел.
    if (notificationsStore.list.length === 0 && !notificationsStore.loading) {
      notificationsStore.init({ forceRefresh: true })
    }
    return
  }
  if (wasOpen) void notificationsStore.persistReadPointer()
}

// Повернули телефон или сузили окно с открытым списком: другой вид — закрываем.
watch(sheet, () => {
  if (visible.value) onOpenChange(false)
})

function safeDocument(): Document | undefined {
  if (typeof document !== 'undefined') return document
  if (typeof window !== 'undefined') {
    return (window as Window & { document?: Document }).document
  }
  return undefined
}

/**
 * Контейнер для overlay: body, чтобы выпадашка была выше мессенджера и
 * полноэкранного оверлея (z-index). В Tauri document может быть недоступен
 * в момент вызова — отсюда защита через `safeDocument()`.
 */
function getPopupContainer(_trigger: HTMLElement | undefined): HTMLElement | undefined {
  return safeDocument()?.body
}
</script>
