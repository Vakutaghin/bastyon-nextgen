/**
 * Раскладка шапки, меню аккаунта и левой панели (Настройки → «Шапка и
 * панели»). Привязана к устройству, как остальной интерфейс в
 * `app-preferences-store`: на телефоне и компьютере удобное разное.
 *
 * Пока человек раскладку не трогал, хранится не она, а «по умолчанию» (null):
 * так до него доходят и новые пункты, и улучшенный порядок из новых версий.
 * Каждый список — сам по себе: переставили меню — шапка по-прежнему «по
 * умолчанию».
 */

import { defineStore } from 'pinia'

import { settingsAPI } from '@/db/apis/settings-api'
import {
  DEFAULT_HEADER_LAYOUT,
  DEFAULT_MENU_LAYOUT,
  DEFAULT_SIDEBAR_BLOCKS,
  DEFAULT_SIDEBAR_LAYOUT,
  LOCKED_MENU_ITEMS,
  isDefaultLayout,
  mergeLayout,
  moveEntry,
  type HeaderItemId,
  type LayoutEntry,
  type MenuItemId,
  type SidebarBlockId,
  type SidebarItemId,
} from './header-layout'

export const HEADER_LAYOUT_KEY = 'headerLayout'

/** `sidebar` — разделы левой панели, `blocks` — блоки под ними. */
export type LayoutListName = 'header' | 'menu' | 'sidebar' | 'blocks'

const LIST_NAMES: readonly LayoutListName[] = ['header', 'menu', 'sidebar', 'blocks']

const DEFAULTS: Record<LayoutListName, readonly LayoutEntry[]> = {
  header: DEFAULT_HEADER_LAYOUT,
  menu: DEFAULT_MENU_LAYOUT,
  sidebar: DEFAULT_SIDEBAR_LAYOUT,
  blocks: DEFAULT_SIDEBAR_BLOCKS,
}

const LOCKED: Record<LayoutListName, readonly string[]> = {
  header: [],
  menu: LOCKED_MENU_ITEMS,
  sidebar: [],
  blocks: [],
}

type StoredLayout = Partial<Record<LayoutListName, unknown>>

/** Чтение с устройства в пути: шапка, меню и панель просят его одновременно. */
let loading: Promise<void> | null = null

export const useHeaderLayoutStore = defineStore('headerLayout', {
  state: () => ({
    /** Своя раскладка значков в шапке; null — по умолчанию. */
    header: null as LayoutEntry<HeaderItemId>[] | null,
    /** Своя раскладка меню аккаунта; null — по умолчанию. */
    menu: null as LayoutEntry<MenuItemId>[] | null,
    /** Свои разделы левой панели; null — по умолчанию. */
    sidebar: null as LayoutEntry<SidebarItemId>[] | null,
    /** Свои блоки под разделами; null — по умолчанию. */
    blocks: null as LayoutEntry<SidebarBlockId>[] | null,
    loaded: false,
  }),

  getters: {
    headerLayout(): LayoutEntry<HeaderItemId>[] {
      return this.header ?? DEFAULT_HEADER_LAYOUT.map((e) => ({ ...e }))
    },
    menuLayout(): LayoutEntry<MenuItemId>[] {
      return this.menu ?? DEFAULT_MENU_LAYOUT.map((e) => ({ ...e }))
    },
    sidebarLayout(): LayoutEntry<SidebarItemId>[] {
      return this.sidebar ?? DEFAULT_SIDEBAR_LAYOUT.map((e) => ({ ...e }))
    },
    blocksLayout(): LayoutEntry<SidebarBlockId>[] {
      return this.blocks ?? DEFAULT_SIDEBAR_BLOCKS.map((e) => ({ ...e }))
    },
    /** Есть ли своя раскладка — тогда есть что сбрасывать. */
    customized(): Record<LayoutListName, boolean> {
      return {
        header: this.header !== null,
        menu: this.menu !== null,
        sidebar: this.sidebar !== null,
        blocks: this.blocks !== null,
      }
    },
  },

  actions: {
    /** Прочитать с устройства. Недоступная база оставляет раскладку по умолчанию (S61). */
    async load(): Promise<void> {
      const raw = (await settingsAPI.get(HEADER_LAYOUT_KEY)) as StoredLayout | null
      for (const list of LIST_NAMES) {
        const saved = raw?.[list]
        this.setList(
          list,
          Array.isArray(saved) ? mergeLayout(saved, DEFAULTS[list], LOCKED[list]) : null
        )
      }
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
      if (!visible && LOCKED[list].includes(id)) return
      const next = this.listOf(list).map((e) => (e.id === id ? { ...e, visible } : e))
      await this.apply(list, next)
    },

    /** Переставить пункт с места `from` на место `to`. */
    async move(list: LayoutListName, from: number, to: number): Promise<void> {
      await this.apply(list, moveEntry(this.listOf(list), from, to))
    },

    /** Вернуть раскладку по умолчанию. */
    async reset(list: LayoutListName): Promise<void> {
      this.setList(list, null)
      await this.persist()
    },

    listOf(list: LayoutListName): LayoutEntry[] {
      switch (list) {
        case 'header':
          return this.headerLayout
        case 'menu':
          return this.menuLayout
        case 'sidebar':
          return this.sidebarLayout
        case 'blocks':
          return this.blocksLayout
      }
    },

    /** Своя раскладка списка; совпала с умолчанием — снова «по умолчанию». */
    setList(list: LayoutListName, next: LayoutEntry[] | null): void {
      const value = next && !isDefaultLayout(next, DEFAULTS[list]) ? next : null
      switch (list) {
        case 'header':
          this.header = value as LayoutEntry<HeaderItemId>[] | null
          break
        case 'menu':
          this.menu = value as LayoutEntry<MenuItemId>[] | null
          break
        case 'sidebar':
          this.sidebar = value as LayoutEntry<SidebarItemId>[] | null
          break
        case 'blocks':
          this.blocks = value as LayoutEntry<SidebarBlockId>[] | null
          break
      }
    },

    async apply(list: LayoutListName, next: LayoutEntry[]): Promise<void> {
      this.setList(list, next)
      await this.persist()
    },

    async persist(): Promise<void> {
      const value: StoredLayout = {}
      for (const list of LIST_NAMES) {
        const own = this[list]
        if (own) value[list] = own.map(({ id, visible }) => ({ id, visible }))
      }
      await settingsAPI.set(HEADER_LAYOUT_KEY, value)
    },
  },
})
