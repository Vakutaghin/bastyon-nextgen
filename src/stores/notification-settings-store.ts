import { defineStore } from 'pinia'
import { settingsAPI } from '@/db/apis/settings-api'
import { accountScopedKey, adoptLegacySettingsKey } from '@/blockchain/storage/account-scoped-key'

export const NOTIFICATION_FILTERS_KEY = 'notificationFilters'

/** Ключи настроек фильтрации уведомлений (как в старом приложении) */
export type NotificationFilterKey =
  | 'sound'
  | 'browserNotif'
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
  /** Браузерные (Web Notification API) уведомления, когда вкладка в фоне. Opt-in. */
  browserNotif: boolean
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
  browserNotif: false,
  win: true,
  transactions: true,
  upvotes: true,
  downvotes: false,
  comments: true,
  answers: true,
  followers: true,
  commentScore: true,
}

/**
 * i18n-ключи подписей для настроек (домен `notif`).
 * Значения — ключи, резолвятся через t() в компоненте при рендере.
 */
export const NOTIFICATION_FILTER_LABEL_KEYS: Record<NotificationFilterKey, string> = {
  sound: 'notif.filterSound',
  browserNotif: 'notif.filterBrowser',
  win: 'notif.filterWin',
  transactions: 'notif.filterTransactions',
  upvotes: 'notif.filterUpvotes',
  downvotes: 'notif.filterDownvotes',
  comments: 'notif.filterComments',
  answers: 'notif.filterAnswers',
  followers: 'notif.filterFollowers',
  commentScore: 'notif.filterCommentScore',
}

/** Владелец настроек: адрес текущего аккаунта, аноним — null (legacy-ключ). */
async function currentOwner(): Promise<string | null> {
  try {
    const { useAuthStore } = await import('@/blockchain/store/auth-store')
    return useAuthStore().getUserAddress
  } catch {
    return null
  }
}

export const useNotificationSettingsStore = defineStore('notificationSettings', {
  state: (): NotificationFiltersState & { owner: string | null } => ({
    ...DEFAULT_FILTERS,
    owner: null,
  }),
  getters: {
    /** Получить значение по ключу */
    getFilter:
      (state) =>
      (key: NotificationFilterKey): boolean =>
        state[key] ?? DEFAULT_FILTERS[key],
  },
  actions: {
    /** Загрузить настройки из IDB (settings) для текущего аккаунта (N25/Р5). */
    async load() {
      try {
        const owner = await currentOwner()
        this.owner = owner
        // Чужие значения (прежнего аккаунта) в памяти не оставляем.
        Object.assign(this, DEFAULT_FILTERS)
        const raw = (await adoptLegacySettingsKey(settingsAPI, NOTIFICATION_FILTERS_KEY, owner)) as
          | Partial<NotificationFiltersState>
          | undefined
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
          browserNotif: this.browserNotif,
          win: this.win,
          transactions: this.transactions,
          upvotes: this.upvotes,
          downvotes: this.downvotes,
          comments: this.comments,
          answers: this.answers,
          followers: this.followers,
          commentScore: this.commentScore,
        }
        await settingsAPI.set(accountScopedKey(NOTIFICATION_FILTERS_KEY, this.owner), payload)
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
  },
})
