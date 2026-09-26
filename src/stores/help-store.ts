/**
 * Справка: боковая панель контекстной справки (кнопки «?» и F1) и то, что
 * читатель настроил под себя на этом устройстве, — избранные статьи и скрытый
 * навигатор. Сами статьи грузятся отдельно (composables/use-help-library.ts),
 * панель монтируется один раз в src.vue.
 */

import { defineStore } from 'pinia'

const FAVORITES_KEY = 'bastyon_help_favorites'
const NAV_HIDDEN_KEY = 'bastyon_help_nav_hidden'
const MAX_FAVORITES = 100

function readFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function readNavHidden(): boolean {
  try {
    return localStorage.getItem(NAV_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Приватный режим или запрет хранилища: настройка просто не запомнится.
  }
}

export const useHelpStore = defineStore('help', {
  state: () => ({
    /** Статьи, открытые в боковой панели: последняя на экране, «Назад» — к предыдущей. */
    panel: [] as string[],
    favorites: readFavorites(),
    navHidden: readNavHidden(),
  }),

  getters: {
    panelTopic: (state): string | null => state.panel[state.panel.length - 1] ?? null,
    isFavorite:
      (state) =>
      (id: string): boolean =>
        state.favorites.includes(id),
  },

  actions: {
    /** Открывает статью в боковой панели поверх текущего экрана. */
    openTopic(id: string): void {
      this.panel = [id]
    },

    /** Переход по ссылке внутри панели: «Назад» вернёт к предыдущей статье. */
    followInPanel(id: string): void {
      if (this.panelTopic !== id) this.panel.push(id)
    },

    backInPanel(): void {
      if (this.panel.length > 1) this.panel.pop()
    },

    closePanel(): void {
      this.panel = []
    },

    toggleFavorite(id: string): void {
      this.favorites = this.favorites.includes(id)
        ? this.favorites.filter((f) => f !== id)
        : [...this.favorites, id].slice(-MAX_FAVORITES)
      persist(FAVORITES_KEY, JSON.stringify(this.favorites))
    },

    setNavHidden(hidden: boolean): void {
      this.navHidden = hidden
      persist(NAV_HIDDEN_KEY, hidden ? '1' : '0')
    },
  },
})
