/**
 * Логика компонента капчи
 */

import { ref, computed, onMounted, watch } from 'vue'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { captchaAPI } from '@/blockchain/api/captcha-api'
import { t } from '@/i18n'

export interface CaptchaProps {
  captcha: CaptchaData | null
  reason?: string
  proxyOptions?: { proxy?: string }
}

export interface CaptchaEmits {
  (e: 'success', captcha: CaptchaData): void
  (e: 'error', error: string): void
  (e: 'redo'): void
}

/** Пауза перед показом картинки и поля — даёт отыграть анимации появления. */
const REVEAL_DELAY_MS = 300

export function useCaptcha(
  p: CaptchaProps,
  emit: CaptchaEmits,
  captchaInputRef?: { value: HTMLInputElement | null }
) {
  const inputText = ref('')
  const imageShown = ref(false)
  const controlsShown = ref(false)

  const reasonText = computed(() => {
    if (!p.reason) return ''
    const reasons: Record<string, string> = {
      registration: t('accountMsg.reasonRegistration'),
      balance: t('accountMsg.reasonBalance'),
    }
    return reasons[p.reason] || p.reason
  })

  const isValid = computed(() => {
    // Валидация: минимум 4 символа, только буквы и цифры
    return /^[a-zA-Z0-9]{4,}$/.test(inputText.value)
  })

  const reveal = () => {
    setTimeout(() => {
      imageShown.value = true
      controlsShown.value = true
    }, REVEAL_DELAY_MS)
  }

  // Обработка ввода
  const handleInput = () => {
    // Валидация происходит через computed isValid
  }

  // Обработка фокуса
  const handleFocus = () => {
    // Прокрутка к полю ввода на мобильных устройствах
    if (window.innerWidth < 768) {
      setTimeout(() => {
        const input =
          captchaInputRef?.value || (document.querySelector('.captcha-input') as HTMLElement)
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 200)
    }
  }

  // Отправка решения капчи
  const handleSubmit = async () => {
    if (!isValid.value || !p.captcha) return

    // make() не бросает: код ошибки приходит в callback. Раньше ветки по
    // исключениям были мёртвыми, и после «попытки кончились» новая капча не
    // запрашивалась.
    let failure: string | null = null
    const result = await captchaAPI.make(
      inputText.value,
      (error) => {
        failure = error
      },
      p.proxyOptions
    )

    if (result?.done) {
      emit('success', result)
      return
    }
    if (failure === 'captchashots') {
      emit('error', t('accountMsg.captchaTooManyAttempts'))
      handleRedo()
      return
    }
    emit('error', t('accountMsg.captchaSolveFailed'))
  }

  // Обновление капчи
  const handleRedo = () => {
    inputText.value = ''
    imageShown.value = false
    controlsShown.value = false

    emit('redo')
  }

  onMounted(() => {
    if (p.captcha) reveal()
  })

  // Новая капча: сбрасываем ввод и показываем заново.
  watch(
    () => p.captcha,
    (newCaptcha) => {
      if (!newCaptcha) return
      inputText.value = ''
      imageShown.value = false
      controlsShown.value = false
      reveal()
    }
  )

  return {
    inputText,
    imageShown,
    controlsShown,
    reasonText,
    isValid,
    handleInput,
    handleFocus,
    handleSubmit,
    handleRedo,
  }
}
