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
    /**
     * Раздел статьи, открытой из приложения (`chats#screen`): якорь или метка
     * раздела. Переход по ссылке внутри панели его сбрасывает.
     */
    panelAnchor: null as string | null,
    /**
     * Статья для F1 вместо `meta.helpTopic` маршрута — когда экран знает
     * точнее: открытая вкладка настроек, мессенджер поверх страницы.
     */
    screenTopic: null as string | null,
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
    /**
     * Открывает статью в боковой панели поверх текущего экрана. `ref` — имя
     * статьи, после `#` — раздел: `chats#screen`.
     */
    openTopic(ref: string): void {
      const hash = ref.indexOf('#')
      this.panel = [hash < 0 ? ref : ref.slice(0, hash)]
      this.panelAnchor = hash < 0 ? null : ref.slice(hash + 1) || null
    },

    /** Переход по ссылке внутри панели: «Назад» вернёт к предыдущей статье. */
    followInPanel(id: string): void {
      this.panelAnchor = null
      if (this.panelTopic !== id) this.panel.push(id)
    },

    backInPanel(): void {
      this.panelAnchor = null
      if (this.panel.length > 1) this.panel.pop()
    },

    /** Экран сообщает, о чём он сейчас; `null` — вернуть статью маршрута. */
    setScreenTopic(topic: string | null): void {
      this.screenTopic = topic
    },

    closePanel(): void {
      this.panel = []
      this.panelAnchor = null
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
