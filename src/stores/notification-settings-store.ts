import { defineStore } from 'pinia'
import { settingsAPI } from '@/db/apis/settings-api'

const NOTIFICATION_FILTERS_KEY = 'notificationFilters'

/** Ключи настроек фильтрации уведомлений (как в старом приложении) */
export type NotificationFilterKey =
  | 'sound'
  | 'win'
  | 'transactions'
  | 'upvotes'
  | 'downvotes'
  | 'comments'
  | 'answers'
  | 'followers'
  | 'commentScore'

export interface NotificationFiltersState {
  sound: boolean
  win: boolean
  transactions: boolean
  upvotes: boolean
  downvotes: boolean
  comments: boolean
  answers: boolean
  followers: boolean
  commentScore: boolean
}

const DEFAULT_FILTERS: NotificationFiltersState = {
  sound: true,
  win: true,
  transactions: true,
  upvotes: true,
  downvotes: false,
  comments: true,
  answers: true,
  followers: true,
  commentScore: true
}

/** Подписи для настроек (как в старом приложении) */
export const NOTIFICATION_FILTER_LABELS: Record<NotificationFilterKey, string> = {
  sound: 'Звук',
  win: 'Coinstake выигрыш',
  transactions: 'Транзакция получена',
  upvotes: 'Новая оценка (лайки)',
  downvotes: 'Новая негативная оценка',
  comments: 'Новый комментарий',
  answers: 'Новый ответ на комментарий',
  followers: 'Новый подписчик',
  commentScore: 'Рейтинг комментария'
}

export const useNotificationSettingsStore = defineStore('notificationSettings', {
  state: (): NotificationFiltersState => ({ ...DEFAULT_FILTERS }),
  getters: {
    /** Получить значение по ключу */
    getFilter: (state) => (key: NotificationFilterKey): boolean => state[key] ?? DEFAULT_FILTERS[key],
  },
  actions: {
    /** Загрузить настройки из IDB (settings) */
    async load() {
      try {
        const raw = await settingsAPI.get(NOTIFICATION_FILTERS_KEY) as Partial<NotificationFiltersState> | undefined
        if (raw && typeof raw === 'object') {
          const keys = Object.keys(DEFAULT_FILTERS) as NotificationFilterKey[]
          keys.forEach((key) => {
            if (typeof raw[key] === 'boolean') {
              this[key] = raw[key] as boolean
            }
          })
        }
      } catch (e) {
        console.error('[notificationSettings] load failed', e)
      }
    },

    /** Сохранить настройки в IDB */
    async save() {
      try {
        const payload: NotificationFiltersState = {
          sound: this.sound,
          win: this.win,
          transactions: this.transactions,
          upvotes: this.upvotes,
          downvotes: this.downvotes,
          comments: this.comments,
          answers: this.answers,
          followers: this.followers,
          commentScore: this.commentScore
        }
        await settingsAPI.set(NOTIFICATION_FILTERS_KEY, payload)
      } catch (e) {
        console.error('[notificationSettings] save failed', e)
      }
    },

    /** Установить одно значение и сохранить в IDB */
    async setFilter(key: NotificationFilterKey, value: boolean) {
      if (!(key in DEFAULT_FILTERS)) return
      this[key] = value
      await this.save()
    },
  }
})
