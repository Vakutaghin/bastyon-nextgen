<template>
  <!-- Глаз в шапке мессенджера — меню скрытых фильтром входящих: не показывать
       их, показывать вместе со всеми или только их; окно «Скрытые чаты» и
       правила в настройках. Рядом — в скольких из них есть новое. -->
  <Dropdown
    v-if="visible"
    v-model:open="menuOpen"
    :trigger="['click']"
    placement="bottomRight"
    :get-popup-container="popupLayer"
  >
    <SC_ScreenToggle
      type="button"
      data-testid="chat-screen-toggle"
      aria-haspopup="menu"
      :class="{ active: screen.showHidden }"
      :aria-expanded="menuOpen"
      :aria-label="label"
      :title="label"
    >
      <EyeOutlined v-if="screen.showHidden" />
      <EyeOffIcon v-else />
      <SC_ScreenCount v-if="screen.hiddenWithNew" data-testid="chat-screen-new">
        {{ screen.hiddenWithNew > 99 ? '99+' : screen.hiddenWithNew }}
      </SC_ScreenCount>
    </SC_ScreenToggle>
    <template #overlay>
      <SC_ScreenMenu role="menu" data-testid="chat-screen-menu" :aria-label="title">
        <SC_ScreenMenuHead>{{ title }}</SC_ScreenMenuHead>
        <SC_ScreenMenuItem
          v-for="v in SCREEN_VIEWS"
          :key="v"
          type="button"
          role="menuitemradio"
          :aria-checked="screen.view === v"
          :data-testid="`chat-screen-view-${v}`"
          @click="pick(v)"
        >
          <SC_ScreenMenuMark><CheckOutlined v-if="screen.view === v" /></SC_ScreenMenuMark>
          {{ t(`messenger.screen.view_${v}`) }}
        </SC_ScreenMenuItem>
        <SC_ScreenMenuDivider />
        <SC_ScreenMenuItem
          type="button"
          role="menuitem"
          data-testid="chat-screen-manage"
          @click="manage"
        >
          <SC_ScreenMenuMark><ListIcon /></SC_ScreenMenuMark>
          {{ t('messenger.screen.manage') }}
        </SC_ScreenMenuItem>
        <SC_ScreenMenuItem
          type="button"
          role="menuitem"
          data-testid="chat-screen-rules"
          @click="rules"
        >
          <SC_ScreenMenuMark><SettingOutlined /></SC_ScreenMenuMark>
          {{ t('messenger.screen.rules') }}
        </SC_ScreenMenuItem>
      </SC_ScreenMenu>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dropdown } from 'ant-design-vue'
import {
  CheckOutlined,
  EyeOffIcon,
  EyeOutlined,
  SettingOutlined,
  ListIcon,
} from '@/components/icons'
import { fixedPopupLayer } from '@/components/popup-container'
import { Z_INDEX } from '@/styles/design-tokens'
import {
  SCREEN_VIEWS,
  useMessengerScreenStore,
  type ScreenView,
} from '../../store/messenger-screen-store'
import { useOpenChatSettings } from './use-open-chat-settings'
import {
  SC_ScreenCount,
  SC_ScreenMenu,
  SC_ScreenMenuDivider,
  SC_ScreenMenuHead,
  SC_ScreenMenuItem,
  SC_ScreenMenuMark,
  SC_ScreenToggle,
} from './styled'

const { t } = useI18n()
const screen = useMessengerScreenStore()
const openChatSettings = useOpenChatSettings()
const menuOpen = ref(false)

/** Глаз нужен, пока есть спрятанные — или пока список показывает их по-особому. */
const visible = computed<boolean>(() => screen.hiddenIds.size > 0 || screen.view !== 'normal')

// Панель — в закреплённом слое над полноэкранным мессенджером (2500): в body
// она стояла бы под ним.
const popupLayer = (): HTMLElement => fixedPopupLayer(Z_INDEX.POPOVER_OVER_MESSENGER)

const title = computed<string>(() => {
  const n = screen.hiddenIds.size
  return n ? t('messenger.screen.menuTitle', { n }, n) : t('messenger.screen.noneHidden')
})

const label = computed<string>(() =>
  screen.hiddenWithNew
    ? `${title.value}. ${t('messenger.screen.withNew', { n: screen.hiddenWithNew }, screen.hiddenWithNew)}`
    : title.value
)

function pick(v: ScreenView): void {
  screen.setView(v)
  menuOpen.value = false
}

function manage(): void {
  menuOpen.value = false
  screen.manageOpen = true
}

function rules(): void {
  menuOpen.value = false
  openChatSettings('screen')
}
</script>
