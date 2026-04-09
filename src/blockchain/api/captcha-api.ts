/**
 * API методы для работы с капчей
 * Аналог sdk.captcha из оригинального приложения
 */

import { fetchHttp } from '@/helpers/api/request'
import { CAPTCHA_STORAGE_KEY } from '../constants/storage'

export interface CaptchaData {
  id: string
  result?: string
  done?: boolean
  hex?: boolean
  frames?: unknown
  overlay?: unknown
  angles?: number[]
}

export interface CaptchaStorage {
  current: string | null
  done: string | null
}

/**
 * Класс для работы с капчей
 */
export class CaptchaAPI {
  private storage: CaptchaStorage = {
    current: null,
    done: null,
  }

  /**
   * Загружает сохраненную капчу из localStorage
   */
  load(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.storage.done = window.localStorage.getItem(CAPTCHA_STORAGE_KEY) || null
      }
    } catch (e) {
      console.warn('Failed to load captcha from localStorage:', e)
    }
  }

  /**
   * Сохраняет решенную капчу в localStorage
   */
  save(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (this.storage.done) {
          window.localStorage.setItem(CAPTCHA_STORAGE_KEY, this.storage.done)
        } else {
          window.localStorage.removeItem(CAPTCHA_STORAGE_KEY)
        }
      }
    } catch (e) {
      console.warn('Failed to save captcha to localStorage:', e)
    }
  }

  /**
   * Получает обычную капчу
   * @param callback - Callback функция (captcha, error)
   * @param refresh - Обновить капчу (игнорировать сохраненную)
   * @param proxyOptions - Опции прокси
   */
  async get(
    callback?: (captcha: CaptchaData | null, error?: string) => void,
    refresh: boolean = false,
    proxyOptions?: { proxy?: string; host?: string; port?: number }
  ): Promise<CaptchaData | null> {
    if (refresh) {
      this.storage.current = null
    }

    try {
      const response = await fetchHttp({
        path: 'captcha',
        data: {
          captcha: this.storage.done || this.storage.current || null,
        },
        options: {
          ...proxyOptions,
          auth: true,
        },
      }) as CaptchaData

      this.storage.current = response.id

      if (response.id !== this.storage.done) {
        this.storage.done = null
      }

      this.save()

      // Если есть результат и капча еще не решена, решаем её автоматически
      if (response.result && !response.done) {
        try {
          const solved = await this.make(response.result, null, undefined, proxyOptions)
          if (solved) {
            response.done = true
            if (callback) callback(response)
            return response
          }
        } catch (err) {
          if (callback) callback(null, String(err))
          return null
        }
      }

      if (callback) callback(response)
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (callback) callback(null, errorMessage)
      return null
    }
  }

  /**
   * Получает hex капчу (с углами)
   * @param callback - Callback функция (captcha, error)
   * @param refresh - Обновить капчу (игнорировать сохраненную)
   * @param proxyOptions - Опции прокси
   */
  async getHex(
    callback?: (captcha: CaptchaData | null, error?: string) => void,
    refresh: boolean = false,
    proxyOptions?: { proxy?: string; host?: string; port?: number }
  ): Promise<CaptchaData | null> {
    if (refresh) {
      this.storage.current = null
    }

    try {
      // Получаем язык из локализации (если доступна)
      const language = 'ru' // TODO: получить из локализации приложения

      const response = await fetchHttp({
        path: 'captchaHex',
        data: {
          captcha: this.storage.done || this.storage.current || null,
          language,
        },
        options: {
          ...proxyOptions,
          auth: true,
        },
      }) as CaptchaData

      this.storage.current = response.id

      if (response.id !== this.storage.done) {
        this.storage.done = null
      }

      this.save()

      // Если есть результат и капча еще не решена, решаем её автоматически
      if (response.result && !response.done && response.angles) {
        try {
          const solved = await this.make(response.result, response.angles, undefined, proxyOptions)
          if (solved) {
            response.done = true
            if (callback) callback(response)
            return response
          }
        } catch (err) {
          if (callback) callback(null, String(err))
          return null
        }
      }

      if (callback) callback(response)
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (callback) callback(null, errorMessage)
      return null
    }
  }

  /**
   * Решает капчу (отправляет решение)
   * @param text - Текст решения капчи
   * @param angles - Углы для hex капчи (если есть)
   * @param callback - Callback функция (error, captcha)
   * @param proxyOptions - Опции прокси
   */
  async make(
    text: string,
    angles: number[] | null,
    callback?: (error: string | null, captcha?: CaptchaData) => void,
    proxyOptions?: { proxy?: string; host?: string; port?: number }
  ): Promise<CaptchaData | null> {
    try {
      const response = await fetchHttp({
        path: 'makecaptcha',
        data: {
          captcha: this.storage.current || null,
          text,
          angles: angles || undefined,
        },
        options: {
          ...proxyOptions,
          auth: true,
        },
      }) as CaptchaData

      // Помечаем капчу как решенную
      response.done = true
      this.storage.done = response.id
      this.save()

      if (callback) callback(null, response)
      return response
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Обрабатываем специальные ошибки
      if (errorMessage.includes('captchashots')) {
        if (callback) callback('captchashots')
        return null
      }

      if (errorMessage.includes('captchanotequal_angles')) {
        if (callback) callback('captchanotequal_angles')
        return null
      }

      if (callback) callback(errorMessage)
      return null
    }
  }
}

// Создаем singleton экземпляр
export const captchaAPI = new CaptchaAPI()

// Загружаем сохраненную капчу при инициализации
if (typeof window !== 'undefined') {
  captchaAPI.load()
}
