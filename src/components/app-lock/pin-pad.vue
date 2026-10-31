<template>
  <SC_PinPad>
    <SC_PinDots
      role="img"
      :aria-label="t('appLock.digitsEntered', { n: value.length, total: length })"
      :class="{ shake }"
      @animationend="shake = false"
    >
      <SC_PinDot v-for="i in length" :key="i" :class="{ filled: i <= value.length, error }" />
    </SC_PinDots>

    <SC_Keypad :class="{ compact }">
      <SC_Key
        v-for="d in TOP_DIGITS"
        :key="d"
        type="button"
        :disabled="disabled"
        @pointerdown="onPointerDown($event, d)"
        @click="onKeyboardClick($event, d)"
      >
        {{ d }}
      </SC_Key>
      <SC_KeyGap />
      <SC_Key
        type="button"
        :disabled="disabled"
        @pointerdown="onPointerDown($event, '0')"
        @click="onKeyboardClick($event, '0')"
      >
        0
      </SC_Key>
      <SC_Key
        type="button"
        class="plain"
        :aria-label="t('appLock.erase')"
        :disabled="disabled || value.length === 0"
        @pointerdown="onPointerDown($event, ERASE)"
        @click="onKeyboardClick($event, ERASE)"
      >
        <BackspaceOutlined />
      </SC_Key>
    </SC_Keypad>
  </SC_PinPad>
</template>

<script setup lang="ts">
// Клавиатура пин-кода: своя, не системная — клавиатура телефона не выезжает и
// не закрывает поле. Набрали все цифры — complete; дальше ввод ждёт, пока
// владелец не скажет fail() (неверно: точки вздрагивают и гаснут) или clear().
// На компьютере цифры набираются и с клавиатуры (keyboard).

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { BackspaceOutlined } from '@/components/icons'
import { haptic } from '@/helpers/common/haptics'
import { SC_Key, SC_KeyGap, SC_Keypad, SC_PinDot, SC_PinDots, SC_PinPad } from './styled'

const props = withDefaults(
  defineProps<{
    length: number
    disabled?: boolean
    /** Цифры, Backspace и Esc с клавиатуры компьютера. */
    keyboard?: boolean
    compact?: boolean
  }>(),
  { disabled: false, keyboard: false, compact: false }
)

const emit = defineEmits<{ complete: [code: string] }>()

const { t } = useI18n()

const TOP_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const ERASE = 'erase'

const value = ref('')
const error = ref(false)
const shake = ref(false)
let failTimer: ReturnType<typeof setTimeout> | null = null

function press(key: string): void {
  if (props.disabled) return
  if (error.value) resetError()
  // Код набран и проверяется: до fail() или clear() клавиши молчат, даже «Стереть».
  else if (value.value.length >= props.length) return
  if (key === ERASE) {
    value.value = value.value.slice(0, -1)
    return
  }
  value.value += key
  if (value.value.length === props.length) emit('complete', value.value)
}

function resetError(): void {
  if (failTimer) clearTimeout(failTimer)
  failTimer = null
  error.value = false
  value.value = ''
}

/** Касание: цифра сразу, подсветка — пока палец на клавише. */
function onPointerDown(e: PointerEvent, key: string): void {
  if (e.button !== 0 || props.disabled) return
  // Без фокуса на клавише: иначе на телефоне остаётся рамка, а Enter жмёт её снова.
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  el.classList.add('pressed')
  const release = (): void => {
    el.classList.remove('pressed')
    el.removeEventListener('pointerup', release)
    el.removeEventListener('pointerleave', release)
    el.removeEventListener('pointercancel', release)
  }
  el.addEventListener('pointerup', release)
  el.addEventListener('pointerleave', release)
  el.addEventListener('pointercancel', release)
  haptic('small')
  press(key)
}

/** click без мыши и пальца (detail 0) — Enter или пробел на клавише в фокусе. */
function onKeyboardClick(e: MouseEvent, key: string): void {
  if (e.detail === 0) press(key)
}

function onKeydown(e: KeyboardEvent): void {
  if (!props.keyboard || e.ctrlKey || e.metaKey || e.altKey) return
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault()
    press(e.key)
  } else if (e.key === 'Backspace') {
    e.preventDefault()
    press(ERASE)
  } else if (e.key === 'Escape' && value.value) {
    e.preventDefault()
    resetError()
  }
}

/** Неверный код: точки краснеют и вздрагивают, потом гаснут. */
function fail(): void {
  error.value = true
  shake.value = true
  haptic('strong')
  if (failTimer) clearTimeout(failTimer)
  failTimer = setTimeout(resetError, 450)
}

function clear(): void {
  resetError()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (failTimer) clearTimeout(failTimer)
})

defineExpose({ fail, clear })
</script>
