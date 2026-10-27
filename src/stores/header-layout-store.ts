/**
 * Раскладка шапки и меню аккаунта (Настройки → «Шапка и меню»). Привязана к
 * устройству, как остальной интерфейс в `app-preferences-store`: на телефоне и
 * компьютере удобное разное.
 *
 * Пока человек раскладку не трогал, хранится не она, а «по умолчанию» (null):
 * так до него доходят и новые пункты, и улучшенный порядок из новых версий.
 */

import { defineStore } from 'pinia'

import { settingsAPI } from '@/db/apis/settings-api'
import {
  DEFAULT_HEADER_LAYOUT,
  DEFAULT_MENU_LAYOUT,
  LOCKED_MENU_ITEMS,
  isDefaultLayout,
  mergeLayout,
  moveEntry,
  type HeaderItemId,
  type LayoutEntry,
  type MenuItemId,
} from './header-layout'

export const HEADER_LAYOUT_KEY = 'headerLayout'

export type LayoutListName = 'header' | 'menu'

interface StoredHeaderLayout {
  header?: unknown
  menu?: unknown
}

/** Чтение с устройства в пути: шапка и меню просят его одновременно. */
let loading: Promise<void> | null = null

export const useHeaderLayoutStore = defineStore('headerLayout', {
  state: () => ({
    /** Своя раскладка значков в шапке; null — по умолчанию. */
    header: null as LayoutEntry<HeaderItemId>[] | null,
    /** Своя раскладка меню аккаунта; null — по умолчанию. */
    menu: null as LayoutEntry<MenuItemId>[] | null,
    loaded: false,
  }),

  getters: {
    headerLayout(): LayoutEntry<HeaderItemId>[] {
      return this.header ?? DEFAULT_HEADER_LAYOUT.map((e) => ({ ...e }))
    },
    menuLayout(): LayoutEntry<MenuItemId>[] {
      return this.menu ?? DEFAULT_MENU_LAYOUT.map((e) => ({ ...e }))
    },
    /** Есть ли своя раскладка — тогда есть что сбрасывать. */
    customized(): Record<LayoutListName, boolean> {
      return { header: this.header !== null, menu: this.menu !== null }
    },
  },

  actions: {
    /** Прочитать с устройства. Недоступная база оставляет раскладку по умолчанию (S61). */
    async load(): Promise<void> {
      const raw = (await settingsAPI.get(HEADER_LAYOUT_KEY)) as StoredHeaderLayout | null
      this.header =
        raw && Array.isArray(raw.header) ? mergeLayout(raw.header, DEFAULT_HEADER_LAYOUT) : null
      this.menu =
        raw && Array.isArray(raw.menu)
          ? mergeLayout(raw.menu, DEFAULT_MENU_LAYOUT, LOCKED_MENU_ITEMS)
          : null
      this.loaded = true
    },

    /** Прочитать, если ещё не читали; одно чтение на всех, кто просит. */
    ensureLoaded(): Promise<void> {
      if (this.loaded) return Promise.resolve()
      loading ??= this.load().finally(() => {
        loading = null
      })
      return loading
    },

    /** Показать или скрыть пункт. Закреплённый пункт меню не скрывается. */
    async setVisible(list: LayoutListName, id: string, visible: boolean): Promise<void> {
      if (list === 'menu' && !visible && LOCKED_MENU_ITEMS.includes(id as MenuItemId)) return
      const next = this.listOf(list).map((e) => (e.id === id ? { ...e, visible } : e))
      await this.apply(list, next)
    },

    /** Переставить пункт с места `from` на место `to`. */
    async move(list: LayoutListName, from: number, to: number): Promise<void> {
      await this.apply(list, moveEntry(this.listOf(list), from, to))
    },

    /** Вернуть раскладку по умолчанию. */
    async reset(list: LayoutListName): Promise<void> {
      this[list] = null
      await this.persist()
    },

    listOf(list: LayoutListName): LayoutEntry[] {
      return list === 'header' ? this.headerLayout : this.menuLayout
    },

    async apply(list: LayoutListName, next: LayoutEntry[]): Promise<void> {
      if (list === 'header') {
        const header = next as LayoutEntry<HeaderItemId>[]
        this.header = isDefaultLayout(header, DEFAULT_HEADER_LAYOUT) ? null : header
      } else {
        const menu = next as LayoutEntry<MenuItemId>[]
        this.menu = isDefaultLayout(menu, DEFAULT_MENU_LAYOUT) ? null : menu
      }
      await this.persist()
    },

    async persist(): Promise<void> {
      const value: StoredHeaderLayout = {}
      if (this.header) value.header = this.header.map(({ id, visible }) => ({ id, visible }))
      if (this.menu) value.menu = this.menu.map(({ id, visible }) => ({ id, visible }))
      await settingsAPI.set(HEADER_LAYOUT_KEY, value)
    },
  },
})
