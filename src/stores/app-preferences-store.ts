/**
 * Настройки приложения, которые старый клиент держал в группах «посты», «видео»,
 * «интерфейс» и «система». Часть из них у нас была прибита в коде (например,
 * сортировка комментариев по умолчанию), часть отсутствовала вовсе.
 *
 * Привязка к устройству, а не к аккаунту: это предпочтения того, кто сидит за
 * этой машиной (анимации, масштаб, автозапуск), и при смене аккаунта они не
 * должны меняться. Настройки, принадлежащие аккаунту, живут отдельно — см.
 * `notification-settings-store`.
 */

import { defineStore } from 'pinia'

import { settingsAPI } from '@/db/apis/settings-api'
import { clearAllDecrypted } from '@/db/apis/decrypted-messages-api'

export const APP_PREFERENCES_KEY = 'appPreferences'

/** Порядок комментариев по умолчанию — те же значения, что у переключателя в посте. */
export type CommentsOrderPreference = 'interesting' | 'newest' | 'oldest'

/** Доступные масштабы интерфейса в процентах (как в старом десктопном клиенте). */
export const UI_SCALES = [80, 90, 100, 110, 125, 150] as const

export interface AppPreferencesState {
  /** Анимации и переходы в интерфейсе. */
  animations: boolean
  /** Встроенные проигрыватели (YouTube, Vimeo) в постах. */
  embeddedVideo: boolean
  /** Автовоспроизведение видео в ленте. */
  videoAutoplay: boolean
  /** Предпросмотр ссылок (карточка сайта под сообщением). */
  linkPreviews: boolean
  /** Порядок комментариев, с которого открывается пост. */
  commentsOrder: CommentsOrderPreference
  /**
   * Круглая кнопка чата в правом нижнем углу (компьютер). Сам чат работает
   * всегда: его открывают и значком в шапке, и с нижней панели телефона.
   */
  chatButton: boolean
  /** Масштаб интерфейса в процентах (десктоп). */
  uiScale: number
  /** Запускать приложение при входе в систему (десктоп). */
  autostart: boolean
  /**
   * Хранить расшифрованные сообщения на устройстве: переписки открываются
   * быстрее, но тексты лежат в IndexedDB незашифрованными.
   */
  storeDecryptedMessages: boolean
}

export const DEFAULT_APP_PREFERENCES: AppPreferencesState = {
  animations: true,
  embeddedVideo: true,
  videoAutoplay: false,
  linkPreviews: true,
  commentsOrder: 'newest',
  chatButton: true,
  uiScale: 100,
  autostart: false,
  storeDecryptedMessages: true,
}

/** Значения, которым нельзя верить из хранилища, чинятся до дефолтных. */
function sanitize(raw: Partial<AppPreferencesState> | null): AppPreferencesState {
  const next: AppPreferencesState = { ...DEFAULT_APP_PREFERENCES }
  if (!raw || typeof raw !== 'object') return next

  for (const key of [
    'animations',
    'embeddedVideo',
    'videoAutoplay',
    'linkPreviews',
    'chatButton',
    'autostart',
    'storeDecryptedMessages',
  ] as const) {
    if (typeof raw[key] === 'boolean') next[key] = raw[key]
  }
  // Прежняя настройка «Мессенджер» выключала чат целиком. Кто её выключил,
  // хотел убрать чат с глаз — остаётся без круглой кнопки, а сам чат работает.
  const legacy = raw as { messengerEnabled?: unknown }
  if (typeof raw.chatButton !== 'boolean' && legacy.messengerEnabled === false) {
    next.chatButton = false
  }
  if (
    raw.commentsOrder === 'interesting' ||
    raw.commentsOrder === 'newest' ||
    raw.commentsOrder === 'oldest'
  ) {
    next.commentsOrder = raw.commentsOrder
  }
  if (typeof raw.uiScale === 'number' && (UI_SCALES as readonly number[]).includes(raw.uiScale)) {
    next.uiScale = raw.uiScale
  }
  return next
}

export const useAppPreferencesStore = defineStore('appPreferences', {
  state: (): AppPreferencesState & { loaded: boolean } => ({
    ...DEFAULT_APP_PREFERENCES,
    loaded: false,
  }),

  actions: {
    /** Прочитать настройки с устройства. Недоступная база оставляет дефолты (S61). */
    async load(): Promise<void> {
      const raw = (await settingsAPI.get(
        APP_PREFERENCES_KEY
      )) as Partial<AppPreferencesState> | null
      Object.assign(this, sanitize(raw))
      this.loaded = true
      // Выключили, а расшифровки остались (записались до загрузки настроек
      // или стирание не прошло) — стираем.
      if (!this.storeDecryptedMessages) await clearAllDecrypted()
    },

    /** Изменить одну настройку и сразу сохранить. */
    async set<K extends keyof AppPreferencesState>(
      key: K,
      value: AppPreferencesState[K]
    ): Promise<void> {
      // Приведение: у стора в `this` лежат ещё и экшены, и дженерик-ключ по
      // состоянию TS туда не пускает, хотя ключ заведомо из состояния.
      ;(this as unknown as AppPreferencesState)[key] = value
      await this.persist()
    },

    async persist(): Promise<void> {
      const {
        animations,
        embeddedVideo,
        videoAutoplay,
        linkPreviews,
        commentsOrder,
        chatButton,
        uiScale,
        autostart,
        storeDecryptedMessages,
      } = this
      await settingsAPI.set(APP_PREFERENCES_KEY, {
        animations,
        embeddedVideo,
        videoAutoplay,
        linkPreviews,
        commentsOrder,
        chatButton,
        uiScale,
        autostart,
        storeDecryptedMessages,
      })
    },
  },
})
