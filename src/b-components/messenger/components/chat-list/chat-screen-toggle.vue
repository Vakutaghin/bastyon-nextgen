<template>
  <!-- Глаз в шапке мессенджера: показать на время чаты, спрятанные фильтром
       входящих, и спрятать их снова. Рядом — в скольких из них есть новое. -->
  <SC_ScreenToggle
    v-if="screen.hiddenIds.size > 0 || screen.showHidden"
    type="button"
    data-testid="chat-screen-toggle"
    :class="{ active: screen.showHidden }"
    :aria-pressed="screen.showHidden"
    :aria-label="label"
    :title="label"
    @click="screen.toggleShowHidden()"
  >
    <EyeOutlined v-if="screen.showHidden" />
    <EyeOffIcon v-else />
    <SC_ScreenCount v-if="screen.hiddenWithNew" data-testid="chat-screen-new">
      {{ screen.hiddenWithNew > 99 ? '99+' : screen.hiddenWithNew }}
    </SC_ScreenCount>
  </SC_ScreenToggle>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { EyeOffIcon, EyeOutlined } from '@/components/icons'
import { useMessengerScreenStore } from '../../store/messenger-screen-store'
import { SC_ScreenCount, SC_ScreenToggle } from './styled'

const { t } = useI18n()
const screen = useMessengerScreenStore()

const label = computed<string>(() => {
  const n = screen.hiddenIds.size
  const action = screen.showHidden
    ? t('messenger.screen.hideAgain')
    : t('messenger.screen.show', { n }, n)
  return screen.hiddenWithNew
    ? `${action}. ${t('messenger.screen.withNew', { n: screen.hiddenWithNew }, screen.hiddenWithNew)}`
    : action
})
</script>
