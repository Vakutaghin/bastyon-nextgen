import { defineStore } from 'pinia'

import { settingsAPI } from '@/db/apis/settings-api'

const SETTING_KEY = 'bastyonServicesShelfHidden'

/**
 * Полка «Сервисы» в ленте: человек может её скрыть, а вернуть — со страницы
 * «Сервисы». Пока настройка не прочитана (`hidden === null`), полки нет:
 * иначе она мигала бы у тех, кто её скрыл.
 */
export const useServicesShelfStore = defineStore('mini-apps:shelf', {
  state: () => ({
    hidden: null as boolean | null,
  }),

  actions: {
    async load(): Promise<void> {
      if (this.hidden !== null) return
      const value = await settingsAPI.get(SETTING_KEY)
      this.hidden = value === true
    },

    async setHidden(hidden: boolean): Promise<void> {
      this.hidden = hidden
      await settingsAPI.set(SETTING_KEY, hidden)
    },
  },
})
