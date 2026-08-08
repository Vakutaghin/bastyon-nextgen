/**
 * Утилита для показа модального окна с капчей
 */

import { createApp, h, ref } from 'vue'
import type { CaptchaData } from '@/blockchain/api/captcha-api'
import { i18n } from '@/i18n'
import CaptchaModal from './captcha-modal.vue'

export interface ShowCaptchaOptions {
  captcha: CaptchaData
  reason?: string
  proxyOptions?: { proxy?: string }
}

/**
 * Показывает модальное окно с капчей и возвращает Promise с решенной капчей
 */
export function showCaptchaModal(options: ShowCaptchaOptions): Promise<CaptchaData> {
  return new Promise((resolve, reject) => {
    const { captcha, reason, proxyOptions } = options

    // Создаем контейнер для модального окна
    const container = document.createElement('div')
    document.body.appendChild(container)

    const currentCaptcha = ref<CaptchaData>(captcha)
    const currentProxyOptions = proxyOptions

    // Создаем Vue приложение с модальным окном
    const app = createApp({
      setup() {
        const isOpen = ref(true)

        const handleSuccess = (solvedCaptcha: CaptchaData) => {
          // Закрываем модальное окно сразу после успешного решения капчи
          isOpen.value = false
          // Небольшая задержка для анимации закрытия, затем очищаем
          setTimeout(() => {
            app.unmount()
            container.remove()
            resolve(solvedCaptcha)
          }, 200) // Уменьшена задержка для более быстрого закрытия
        }

        const handleError = (error: string) => {
          // Ошибка показывается в модальном окне, но не закрывает его
          console.error('Captcha error:', error)
        }

        const handleCancel = () => {
          isOpen.value = false
          setTimeout(() => {
            app.unmount()
            container.remove()
            reject(new Error('Captcha cancelled'))
          }, 300)
        }

        const handleRedo = async () => {
          // Обновление капчи - получаем новую через API
          try {
            const { captchaAPI } = await import('@/blockchain/api/captcha-api')
            const newCaptcha = await captchaAPI.getHex(undefined, true, currentProxyOptions)
            if (newCaptcha) {
              currentCaptcha.value = newCaptcha
            }
          } catch (error) {
            console.error('Failed to refresh captcha:', error)
          }
        }

        const handleUpdateOpen = (value: boolean) => {
          isOpen.value = value
          if (!value) {
            handleCancel()
          }
        }

        return () =>
          h(CaptchaModal, {
            open: isOpen.value,
            captcha: currentCaptcha.value,
            reason,
            proxyOptions: currentProxyOptions,
            onSuccess: handleSuccess,
            onError: handleError,
            onCancel: handleCancel,
            onUpdateOpen: handleUpdateOpen,
            onRedo: handleRedo,
          })
      },
    })

    // См. main.ts: vue3-styled-components делает inject('theme') без дефолта в
    // каждом styled-компоненте. Это отдельный app-инстанс (модалка вне основного
    // дерева), поэтому стаб темы нужно отдать и здесь, иначе Vue снова сыпет
    // «injection "theme" not found».
    app.provide('theme', {})

    // Отдельный app-инстанс не наследует плагины основного приложения, поэтому
    // i18n нужно установить вручную — иначе useI18n() в <Captcha> бросает ошибку
    // в setup(), компонент капчи не монтируется, и регистрация падает с
    // «Не удалось решить капчу».
    app.use(i18n)

    app.mount(container)
  })
}
