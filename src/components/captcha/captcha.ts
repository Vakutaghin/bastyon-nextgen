/**
 * Логика компонента капчи
 */

import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { captchaAPI } from '@/blockchain/api/captcha-api'

// Типы для HexCaptcha
interface HexCaptchaInstance {
  angles: number[]
  show: (state: 'loading' | 'success' | 'error') => void
}

// Динамический импорт HexCaptcha (если доступен)
let HexCaptchaClass: any = null
let hexCaptchaStylesLoaded = false

async function loadHexCaptcha() {
  if (HexCaptchaClass) return HexCaptchaClass

  try {
    // Используем полностью динамический импорт через переменную,
    // чтобы Vite не мог проанализировать его статически
    // Это позволяет сделать hex-captcha опциональной зависимостью
    // Формируем имя модуля динамически, чтобы Vite не распознал его
    const parts = ['hex', 'captcha']
    const moduleName = parts.join('-')

    // Используем Function constructor для создания динамического импорта
    // Это гарантирует, что Vite не сможет проанализировать импорт статически
    const dynamicImport = new Function('specifier', 'return import(specifier)')
    const hexCaptchaModule = await dynamicImport(moduleName)
    HexCaptchaClass = hexCaptchaModule.default || hexCaptchaModule

    // Загружаем стили, если еще не загружены
    if (!hexCaptchaStylesLoaded && typeof document !== 'undefined') {
      try {
        // Пробуем загрузить CSS из node_modules
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = '/node_modules/hex-captcha/css/captcha.css'
        document.head.appendChild(link)
        hexCaptchaStylesLoaded = true
      } catch (cssError) {
        console.warn('Failed to load hex-captcha CSS:', cssError)
      }
    }

    return HexCaptchaClass
  } catch (error) {
    console.warn('HexCaptcha library not available:', error)
    return null
  }
}

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

export function useCaptcha(
  p: CaptchaProps, emit: CaptchaEmits,
  captchaInputRef?: { value: HTMLInputElement | null },
) {
  const inputText = ref('')
  const imageShown = ref(false)
  const controlsShown = ref(false)
  const captchaImageRef = ref<HTMLElement | null>(null)
  const hexCaptchaInstance = ref<HexCaptchaInstance | null>(null)

  const reasonText = computed(() => {
    if (!p.reason) return ''
    const reasons: Record<string, string> = {
      registration: 'Регистрация аккаунта',
      balance: 'Пополнение баланса',
    }
    return reasons[p.reason] || p.reason
  })

  const isValid = computed(() => {
    // Валидация: минимум 4 символа, только буквы и цифры
    return /^[a-zA-Z0-9]{4,}$/.test(inputText.value)
  })

  // Инициализация hex капчи
  const initHexCaptcha = async () => {
    if (!p.captcha?.hex || !captchaImageRef.value) return

    try {
      const HexCaptcha = await loadHexCaptcha()

      if (HexCaptcha && p.captcha.frames && p.captcha.overlay) {
        // Создаем экземпляр HexCaptcha
        const instance = new HexCaptcha({
          holder: captchaImageRef.value,
          data: {
            frames: p.captcha.frames,
            overlay: p.captcha.overlay,
            duration: 250,
          },
        })

        hexCaptchaInstance.value = instance as HexCaptchaInstance

        setTimeout(() => {
          imageShown.value = true
          controlsShown.value = true
        }, 300)
      } else {
        // Если библиотека недоступна, просто показываем изображение
        setTimeout(() => {
          imageShown.value = true
          controlsShown.value = true
        }, 300)
      }
    } catch (error) {
      console.error('Failed to initialize HexCaptcha:', error)
      // Fallback: показываем обычное изображение
      setTimeout(() => {
        imageShown.value = true
        controlsShown.value = true
      }, 300)
    }
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
        const input = captchaInputRef?.value || document.querySelector('.captcha-input') as HTMLElement
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 200)
    }
  }

  // Отправка решения капчи
  const handleSubmit = async () => {
    if (!isValid.value || !p.captcha) return

    try {
      // Получаем углы для hex капчи, если есть
      const angles = hexCaptchaInstance.value?.angles || null

      // Отправляем решение
      const result = await captchaAPI.make(
        inputText.value,
        angles,
        undefined,
        p.proxyOptions
      )

      if (result && result.done) {
        // Капча успешно решена - сразу эмитим success
        emit('success', result)
      } else {
        emit('error', 'Не удалось решить капчу')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage === 'captchashots') {
        emit('error', 'Превышено количество попыток. Пожалуйста, обновите капчу.')
        handleRedo()
        return
      }

      if (errorMessage === 'captchanotequal_angles') {
        emit('error', 'Углы не совпадают. Попробуйте еще раз.')
        return
      }

      emit('error', errorMessage || 'Ошибка при решении капчи')
    }
  }

  // Обновление капчи
  const handleRedo = () => {
    // Очищаем hex капчу, если была инициализирована
    if (hexCaptchaInstance.value && captchaImageRef.value) {
      const container = captchaImageRef.value.querySelector('.hexCaptcha')
      if (container) {
        container.remove()
      }
      hexCaptchaInstance.value = null
    }

    inputText.value = ''
    imageShown.value = false
    controlsShown.value = false

    emit('redo')
  }

  // Инициализация при монтировании
  onMounted(() => {
    if (p.captcha) {
      if (p.captcha.hex) {
        initHexCaptcha()
      } else {
        setTimeout(() => {
          imageShown.value = true
          controlsShown.value = true
        }, 300)
      }
    }
  })

  // Очистка при размонтировании
  onUnmounted(() => {
    if (hexCaptchaInstance.value && captchaImageRef.value) {
      const container = captchaImageRef.value.querySelector('.hexCaptcha')
      if (container) {
        container.remove()
      }
    }
  })

  // Отслеживание изменений капчи
  watch(() => p.captcha, (newCaptcha) => {
    if (newCaptcha) {
      // Очищаем предыдущую hex капчу
      if (hexCaptchaInstance.value && captchaImageRef.value) {
        const container = captchaImageRef.value.querySelector('.hexCaptcha')
        if (container) {
          container.remove()
        }
        hexCaptchaInstance.value = null
      }

      inputText.value = ''
      imageShown.value = false
      controlsShown.value = false

      if (newCaptcha.hex) {
        initHexCaptcha()
      } else {
        setTimeout(() => {
          imageShown.value = true
          controlsShown.value = true
        }, 300)
      }
    }
  })

  return {
    inputText,
    imageShown,
    controlsShown,
    captchaImageRef,
    reasonText,
    isValid,
    handleInput,
    handleFocus,
    handleSubmit,
    handleRedo,
  }
}
