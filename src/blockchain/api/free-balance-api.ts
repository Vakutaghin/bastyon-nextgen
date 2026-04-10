/**
 * API для запроса бесплатных unspents (баланса) для регистрации
 * Аналог requestUnspents из оригинального приложения
 * (js/lib/client/actions.js:1884-1948)
 */

import { fetchHttp } from '@/helpers/api/request'
import { captchaAPI } from './captcha-api'
import type { CaptchaData } from './captcha-api'
import { showCaptchaModal } from '@/components/captcha'
import { getProxyWithWalletCached } from './proxy-with-wallet'
import { isCaptchaError, isRegistrationBlockingError } from '@/helpers/api/error-codes'
import { logger } from '@/services/logger'

const log = logger.scope('[requestUnspents]')

export interface RequestUnspentsParams {
  /** Причина запроса ('registration' для регистрации) */
  reason: string
}

export interface RequestUnspentsResult {
  /** ID действия (для отслеживания) */
  action: string
  /** Прокси, через который был выполнен запрос */
  proxy?: { host: string; port: number }
}

const MAX_CAPTCHA_RETRIES = 3

/**
 * Запрашивает бесплатные unspents для регистрации.
 */
export async function requestUnspents(
  address: string,
  params: RequestUnspentsParams,
  onCaptchaRequired?: (captcha: CaptchaData) => Promise<CaptchaData>,
  _retryCount: number = 0,
): Promise<RequestUnspentsResult> {
  const { reason } = params

  // Шаг 1: Найти прокси с регистрационным кошельком
  log.debug('Step 1: finding proxy with wallet...')
  const proxyServer = await getProxyWithWalletCached()

  if (!proxyServer) {
    log.error('No proxy with wallet found!')
    throw new Error('Не удалось найти прокси с регистрационным кошельком. Попробуйте позже.')
  }

  log.debug('Found proxy:', proxyServer.host, proxyServer.port)

  const proxyOptions = { host: proxyServer.host, port: proxyServer.port }

  // Шаг 2: Проверяем ключи
  const { useAuthStore } = await import('@/blockchain/store/auth-store')
  const authStore = useAuthStore()
  const keyPair = authStore.getKeyPair
  const userAddress = authStore.getUserAddress

  if (!keyPair || !userAddress) {
    throw new Error('Ключи не найдены. Пожалуйста, убедитесь, что вы зарегистрированы.')
  }

  log.debug('Step 2: keys OK, address:', userAddress)

  // Шаг 3: Решаем капчу через тот же прокси
  let captcha: CaptchaData | null = null

  log.debug('Step 3: solving captcha...')

  try {
    captcha = await captchaAPI.getHex(undefined, false, proxyOptions)
    log.debug('getHex result:', captcha ? { id: captcha.id, done: captcha.done } : null)

    if (!captcha || !captcha.done) {
      captcha = await captchaAPI.get(undefined, false, proxyOptions)
      log.debug('get result:', captcha ? { id: captcha.id, done: captcha.done } : null)
    }

    // Если капча не решена автоматически, показываем пользователю
    if (captcha && !captcha.done) {
      log.debug('Captcha not auto-solved, showing modal...')
      if (onCaptchaRequired) {
        captcha = await onCaptchaRequired(captcha)
      } else {
        try {
          captcha = await showCaptchaModal({
            captcha,
            reason,
            proxyOptions,
          })
        } catch {
          throw new Error('captcha_cancelled')
        }
      }
    }

    if (!captcha || !captcha.done) {
      log.error('Captcha not solved! captcha:', captcha)
      throw new Error('captcha_failed')
    }

    log.debug('Captcha solved! id:', captcha.id)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)

    if ((msg === 'captcha_failed' || msg === 'captcha_cancelled') && _retryCount < MAX_CAPTCHA_RETRIES) {
      log.debug('Captcha retry', _retryCount + 1, 'of', MAX_CAPTCHA_RETRIES)
      return requestUnspents(address, params, onCaptchaRequired, _retryCount + 1)
    }

    log.error('Captcha error:', msg)
    throw new Error('Не удалось решить капчу. Попробуйте позже.')
  }

  // Шаг 4: Отправляем free/balance через тот же прокси
  log.debug('Step 4: sending free/balance to', proxyServer.host, '...')

  try {
    const response = await fetchHttp({
      path: 'free/balance',
      data: {
        address,
        captcha: captcha.id,
        key: reason,
      },
      options: {
        auth: true,
        ...proxyOptions,
      },
    }) as { action?: string }

    log.debug('free/balance response:', response)

    return {
      action: response.action || '',
      proxy: proxyServer,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('free/balance error:', errorMessage)

    if (isCaptchaError(errorMessage) && _retryCount < MAX_CAPTCHA_RETRIES) {
      return requestUnspents(address, params, onCaptchaRequired, _retryCount + 1)
    }

    if (isRegistrationBlockingError(errorMessage)) {
      throw new Error(`Ошибка регистрации: ${errorMessage}. Обратитесь в поддержку.`)
    }

    throw error
  }
}
