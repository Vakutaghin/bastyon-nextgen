<template>
  <!-- Лист на телефоне — поверх страницы, а во весь экран — внутри плеера:
       вне полноэкранного элемента его не видно. -->
  <Teleport to="body" :disabled="!touch || fullscreen">
    <template v-if="open">
      <SC_SettingsBackdrop v-if="touch" data-player-control @click="emit('close')" />
      <component
        :is="touch ? SC_SettingsSheet : SC_SettingsMenu"
        ref="panelRef"
        :class="{ 'settings-sheet': touch }"
        role="menu"
        data-player-control
        @click.stop
      >
        <template v-if="screen === 'main'">
          <SC_MenuItem
            v-if="qualityLevels.length > 0"
            type="button"
            role="menuitem"
            @click="emit('screen', 'quality')"
          >
            <TuneIcon />
            <SC_MenuLabel>{{ t('videoPlayer.quality') }}</SC_MenuLabel>
            <SC_MenuValue>{{ qualityLabel }}<ChevronRightIcon /></SC_MenuValue>
          </SC_MenuItem>
          <SC_MenuItem type="button" role="menuitem" @click="emit('screen', 'speed')">
            <SpeedIcon />
            <SC_MenuLabel>{{ t('videoPlayer.speed') }}</SC_MenuLabel>
            <SC_MenuValue>{{ rateLabel(currentRate) }}<ChevronRightIcon /></SC_MenuValue>
          </SC_MenuItem>
        </template>

        <template v-else-if="screen === 'quality'">
          <SC_MenuHeader type="button" @click="emit('screen', 'main')">
            <ChevronLeftIcon />
            <span>{{ t('videoPlayer.quality') }}</span>
          </SC_MenuHeader>
          <SC_MenuItem
            v-for="level in qualityLevels"
            :key="level.index"
            type="button"
            role="menuitemradio"
            :aria-checked="!autoQuality && currentQuality === level.index"
            @click="emit('quality', level.index)"
          >
            <SC_MenuCheck
              ><CheckIcon v-if="!autoQuality && currentQuality === level.index"
            /></SC_MenuCheck>
            <SC_MenuLabel>{{ level.label }}</SC_MenuLabel>
          </SC_MenuItem>
          <SC_MenuItem
            type="button"
            role="menuitemradio"
            :aria-checked="autoQuality"
            @click="emit('quality', -1)"
          >
            <SC_MenuCheck><CheckIcon v-if="autoQuality" /></SC_MenuCheck>
            <SC_MenuLabel>{{ t('videoMsg.qualityAuto') }}</SC_MenuLabel>
          </SC_MenuItem>
        </template>

        <template v-else>
          <SC_MenuHeader type="button" @click="emit('screen', 'main')">
            <ChevronLeftIcon />
            <span>{{ t('videoPlayer.speed') }}</span>
          </SC_MenuHeader>
          <SC_MenuItem
            v-for="rate in rates"
            :key="rate"
            type="button"
            role="menuitemradio"
            :aria-checked="currentRate === rate"
            @click="emit('rate', rate)"
          >
            <SC_MenuCheck><CheckIcon v-if="currentRate === rate" /></SC_MenuCheck>
            <SC_MenuLabel>{{ rateLabel(rate) }}</SC_MenuLabel>
          </SC_MenuItem>
        </template>
      </component>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SpeedIcon, TuneIcon } from './player-icons'
import {
  SC_SettingsMenu,
  SC_SettingsBackdrop,
  SC_SettingsSheet,
  SC_MenuItem,
  SC_MenuLabel,
  SC_MenuValue,
  SC_MenuHeader,
  SC_MenuCheck,
} from '../styled'

type Screen = 'main' | 'quality' | 'speed'

const props = defineProps<{
  open: boolean
  touch: boolean
  fullscreen: boolean
  screen: Screen
  qualityLevels: Array<{ index: number; label: string }>
  currentQuality: number | null
  autoQuality: boolean
  /** Строка главного меню: «Авто (720p)», «480p». */
  qualityLabel: string
  rates: number[]
  currentRate: number
  /** Корень плеера: нажатие по самому ролику меню закрывает плеер, без паузы. */
  playerRoot?: () => HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'screen', screen: Screen): void
  (e: 'quality', index: number): void
  (e: 'rate', rate: number): void
  (e: 'close'): void
}>()

const { t, locale } = useI18n()

const panelRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)

/** «Обычная» для 1×, остальное — числом, как в меню YouTube. */
function rateLabel(rate: number): string {
  if (rate === 1) return t('videoPlayer.normalSpeed')
  return rate.toLocaleString(locale.value)
}

function panelEl(): HTMLElement | null {
  const r = panelRef.value
  if (r instanceof HTMLElement) return r
  return r?.$el instanceof HTMLElement ? r.$el : null
}

/** Компьютер: нажатие мимо меню и мимо шестерёнки закрывает меню. */
function onOutsidePointer(event: PointerEvent): void {
  const target = event.target as Element | null
  if (!target) return
  if (panelEl()?.contains(target)) return
  if (target.closest('[data-settings-toggle]')) return
  const root = props.playerRoot?.()
  if (root?.contains(target) && !target.closest('[data-player-control]')) return
  emit('close')
}

watch(
  () => props.open && !props.touch,
  (listen) => {
    if (listen) window.addEventListener('pointerdown', onOutsidePointer, true)
    else window.removeEventListener('pointerdown', onOutsidePointer, true)
  },
  { immediate: true }
)

onBeforeUnmount(() => window.removeEventListener('pointerdown', onOutsidePointer, true))
</script>
