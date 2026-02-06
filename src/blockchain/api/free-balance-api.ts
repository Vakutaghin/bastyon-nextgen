/**
 * API для запроса бесплатных unspents (баланса) для регистрации
 * Аналог requestUnspents из оригинального приложения
 */

import { fetchHttp } from '@/helpers/api/request'
import { captchaAPI } from './captcha-api'
import type { CaptchaData } from './captcha-api'
import { showCaptchaModal } from '@/components/captcha'

export interface RequestUnspentsParams {
  /** Причина запроса ('registration' для регистрации) */
  reason: string
  /** Опции прокси */
  proxyOptions?: { proxy?: string }
}

export interface RequestUnspentsResult {
  /** ID действия (для отслеживания) */
  action: string
  /** Прокси, через который был выполнен запрос */
  proxy?: string
}

/**
 * Запрашивает бесплатные unspents для регистрации
 * Включает решение капчи, если требуется
 * 
 * @param address - Адрес пользователя
 * @param params - Параметры запроса
 * @param onCaptchaRequired - Callback для показа капчи пользователю (опционально)
 * @returns Promise с результатом запроса
 */
export async function requestUnspents(
  address: string,
  params: RequestUnspentsParams,
  onCaptchaRequired?: (captcha: CaptchaData) => Promise<CaptchaData>
): Promise<RequestUnspentsResult> {
  const { reason, proxyOptions } = params

  // Шаг 1: Получаем прокси (если не указан)
  let proxy = proxyOptions?.proxy

  // TODO: Реализовать получение прокси через API, если нужно
  // const proxy = await getProxyWithWallet()

  // Шаг 2: Проверяем, что ключи доступны для подписи запросов
  // Для endpoints капчи требуется авторизация
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const userAddress = authStore.getUserAddress

  if (!keyPair || !userAddress) {
    throw new Error('Ключи не найдены. Пожалуйста, убедитесь, что вы зарегистрированы.')
  }

  // Шаг 3: Решаем капчу
  let captcha: CaptchaData | null = null

  try {
    // Пробуем получить капчу (обычную или hex)
    // В оригинальном приложении проверяется hasHexCaptcha()
    // Для упрощения пробуем сначала hex, потом обычную
    captcha = await captchaAPI.getHex(undefined, false, proxyOptions)
    
    if (!captcha || !captcha.done) {
      // Если hex капча не получена или не решена, пробуем обычную
      captcha = await captchaAPI.get(undefined, false, proxyOptions)
    }

    // Если капча не решена, показываем модальное окно пользователю
    if (captcha && !captcha.done) {
      if (onCaptchaRequired) {
        // Используем переданный callback, если есть
        captcha = await onCaptchaRequired(captcha)
      } else {
        // Иначе показываем модальное окно
        try {
          captcha = await showCaptchaModal({
            captcha,
            reason,
            proxyOptions,
          })
        } catch (error) {
          // Пользователь отменил или произошла ошибка
          throw new Error('captcha')
        }
      }
    }

    // Если капча все еще не решена, выбрасываем ошибку
    if (!captcha || !captcha.done) {
      throw new Error('captcha')
    }
  } catch (error) {
    // Если ошибка связана с капчей, пробуем еще раз
    if (error instanceof Error && error.message === 'captcha') {
      // Рекурсивно вызываем функцию для повторной попытки
      return requestUnspents(address, params, onCaptchaRequired)
    }
    throw error
  }

  // Шаг 4: Отправляем запрос на получение бесплатных unspents
  try {
    const response = await fetchHttp({
      path: 'free/balance',
      data: {
        address,
        captcha: captcha.id,
        key: reason,
      },
      options: {
        ...proxyOptions,
        auth: true,
      },
    }) as { action?: string }

    // Шаг 5: Ожидаем изменения unspents
    // В оригинальном приложении используется willChangeUnspentsCallback
    // Здесь мы просто возвращаем результат

    return {
      action: response.action || '',
      proxy,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Обрабатываем специальные ошибки
    if (errorMessage === 'captcha' || errorMessage.includes('captcha')) {
      // Если требуется капча, пробуем еще раз
      return requestUnspents(address, params, onCaptchaRequired)
    }

    if (
      errorMessage === 'noproxywithwallet' ||
      errorMessage === 'error' ||
      errorMessage === 'iplimit' ||
      errorMessage === 'uniq'
    ) {
      // Эти ошибки требуют обращения в поддержку
      // TODO: Реализовать механизм поддержки
      throw new Error(`Support required: ${errorMessage}`)
    }

    throw error
  }
}
