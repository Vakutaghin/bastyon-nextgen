<template>
  <!-- И меню, и лист — поверх страницы: в низком ролике (канал в виджете чата,
       плеер, уехавший под шапку) меню целиком не помещалось, а теперь встаёт
       там, где есть место. Во весь экран — внутри плеера: вне полноэкранного
       элемента их не видно. -->
  <UiPortal :disabled="fullscreen">
    <template v-if="open">
      <SC_SettingsBackdrop v-if="touch" data-player-control @click="emit('close')" />
      <component
        :is="touch ? SC_SettingsSheet : SC_SettingsMenu"
        :key="fullscreen ? 'inside' : 'over'"
        :ref="setPanel"
        :class="{ 'settings-sheet': touch }"
        role="menu"
        data-player-control
        data-testid="player-settings"
        @mousedown.prevent
        @click.stop
        @keydown="onMenuKeydown"
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
  </UiPortal>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { bcp47 } from '@/i18n'
import { useFloating } from '@/components/ui-core/floating'
import { lastInputWasKeyboard, trackInputModality } from '@/components/ui-core/input-modality'
import { useElementRef } from '@/components/ui-core/trigger'
import { useLayer } from '@/components/ui-core/use-layer'
import UiPortal from '@/components/ui-core/ui-portal.vue'
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
  /** Корень плеера: в нём шестерёнка, от которой открыто меню. */
  playerRoot?: () => HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'screen', screen: Screen): void
  (e: 'quality', index: number): void
  (e: 'rate', rate: number): void
  (e: 'close'): void
}>()

const { t, locale } = useI18n()

/** Поля меню, как у YouTube: 12px от края ролика и 13px над рядом кнопок. */
const MENU_INSET = 12
const MENU_GAP = 13
const FOCUS_FRAMES = 10

/** «Обычная» для 1×, остальное — числом, как в меню YouTube. */
function rateLabel(rate: number): string {
  if (rate === 1) return t('videoPlayer.normalSpeed')
  return rate.toLocaleString(bcp47(locale.value))
}

const { el: panel, setRef: setPanel } = useElementRef()
trackInputModality()

const gear = (): HTMLElement | null =>
  props.playerRoot?.()?.querySelector<HTMLElement>('[data-settings-toggle]') ?? null

/** Лист на телефоне закрывает своя подложка, меню — стек слоёв. */
const asMenu = computed(() => props.open && !props.touch)

// Esc, «Назад» и нажатие мимо: по ролику — без паузы, нажатие гасит маска.
const { zIndex } = useLayer(asMenu, {
  kind: 'popover',
  el: () => panel.value,
  anchor: gear,
  onDismiss: (reason) => {
    emit('close')
    if (reason === 'escape') gear()?.focus({ preventScroll: true })
  },
})

useFloating(
  () => asMenu.value && !props.fullscreen,
  () => gear()?.closest<HTMLElement>('[data-player-control]') ?? null,
  () => panel.value,
  { placement: 'topRight', offset: MENU_GAP, alignOffset: MENU_INSET }
)

watch(
  [panel, zIndex],
  ([el, z]) => {
    if (el && z && asMenu.value && !props.fullscreen) el.style.zIndex = String(z)
  },
  { flush: 'post' }
)

const menuButtons = (): HTMLElement[] => [...(panel.value?.querySelectorAll('button') ?? [])]

// С клавиатуры: меню в конце страницы, Tab до него не дойдёт — фокус ставим
// сами, и при смене экрана (Качество, Скорость) тоже.
watch(
  () => [asMenu.value, props.screen] as const,
  ([isOpen], [wasOpen]) => {
    if (!isOpen || !lastInputWasKeyboard()) return
    const inMenu = panel.value?.contains(document.activeElement)
    if (wasOpen && !inMenu) return
    void nextTick(() => focusFirst())
  }
)

/**
 * Меню скрыто, пока не посчитано его место, и ещё кадр после: фокус не встаёт.
 * Пробуем, пока не встанет.
 */
function focusFirst(frames = FOCUS_FRAMES): void {
  const first = menuButtons()[0]
  first?.focus({ preventScroll: true })
  if (first && document.activeElement !== first && frames > 0) {
    requestAnimationFrame(() => focusFirst(frames - 1))
  }
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (props.touch) return
  if (event.key === 'Tab') {
    event.preventDefault()
    emit('close')
    gear()?.focus({ preventScroll: true })
    return
  }
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  const buttons = menuButtons()
  const at = buttons.indexOf(document.activeElement as HTMLElement)
  event.preventDefault()
  buttons[(at + step + buttons.length) % buttons.length]?.focus({ preventScroll: true })
}
</script>
