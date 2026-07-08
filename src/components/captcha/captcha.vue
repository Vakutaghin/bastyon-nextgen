<template>
  <SC_CaptchaWrapper>
    <SC_Reason v-if="reasonText">
      <span>{{ reasonText }}</span>
    </SC_Reason>

    <SC_Subcaption>
      <span>{{ captcha?.hex ? t('misc.solveHexCaptcha') : t('misc.enterTextFromImage') }}</span>
    </SC_Subcaption>

    <SC_CaptchaImageWrapper :shown="imageShown">
      <SC_CaptchaImage ref="captchaImageRef">
        <!-- SVG капчи приходит с ноды (недоверенный источник). Рендерим через
             data-URI <img>, а не v-html: SVG внутри <img> исполняется в
             sandbox-режиме (без скриптов/внешних запросов) — закрывает P1-4. -->
        <SC_CaptchaSvgImage v-if="captchaImgSrc">
          <img :src="captchaImgSrc" :alt="t('misc.enterTextFromImage')" />
        </SC_CaptchaSvgImage>
      </SC_CaptchaImage>
    </SC_CaptchaImageWrapper>

    <SC_Controls :shown="controlsShown">
      <SC_InputWrapper>
        <SC_CaptchaInput
          ref="captchaInputRef"
          v-model="inputText"
          type="text"
          :placeholder="t('misc.enterText')"
          @keyup="handleInput"
          @focus="handleFocus"
        />
      </SC_InputWrapper>

      <SC_ButtonsContainer>
        <SC_SubmitButton :disabled="!isValid" @click="handleSubmit">
          {{ t('misc.next') }}
        </SC_SubmitButton>
        <SC_RedoButton @click="handleRedo">
          {{ t('misc.refresh') }}
        </SC_RedoButton>
      </SC_ButtonsContainer>
    </SC_Controls>
  </SC_CaptchaWrapper>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { useCaptcha } from './captcha'
import {
  SC_CaptchaWrapper,
  SC_Reason,
  SC_Subcaption,
  SC_CaptchaImageWrapper,
  SC_CaptchaImage,
  SC_CaptchaSvgImage,
  SC_Controls,
  SC_InputWrapper,
  SC_CaptchaInput,
  SC_ButtonsContainer,
  SC_SubmitButton,
  SC_RedoButton,
} from './styled'

const p = defineProps<{
  captcha: CaptchaData | null
  reason?: string
  proxyOptions?: { proxy?: string }
}>()

const emit = defineEmits<{
  (e: 'success', captcha: CaptchaData): void
  (e: 'error', error: string): void
  (e: 'redo'): void
}>()

const { t } = useI18n()

const captchaInputRef = ref<HTMLInputElement | null>(null)

/**
 * SVG-капча как data-URI для рендера через <img> (P1-4). Кодируем в base64
 * с поддержкой юникода. Только для текстовой капчи (hex-капча грузит свою
 * библиотеку отдельно).
 */
const captchaImgSrc = computed<string>(() => {
  const svg = p.captcha?.img
  if (!svg || p.captcha?.hex) return ''
  try {
    const b64 = window.btoa(unescape(encodeURIComponent(svg)))
    return `data:image/svg+xml;base64,${b64}`
  } catch {
    return ''
  }
})

const {
  inputText,
  imageShown,
  controlsShown,
  reasonText,
  isValid,
  handleInput,
  handleFocus,
  handleSubmit,
  handleRedo,
} = useCaptcha(p, emit, captchaInputRef)
</script>

<!-- Стили hex-captcha загружаются динамически через JS, если библиотека доступна -->
