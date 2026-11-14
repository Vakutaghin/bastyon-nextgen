import { inject, type InjectionKey } from 'vue'
import type { MenuActionItem, MenuEmits, MenuItem } from './types'

/** Меню внутри Dropdown: пункт выбран — панель закрывается, Tab — тоже. */
export interface MenuHost {
  close(): void
}

export const MENU_HOST: InjectionKey<MenuHost> = Symbol('menu-host')

const ITEM = '.ui-menu__item:not([aria-disabled="true"])'

export function isDivider(item: MenuItem): item is { type: 'divider'; key?: string } {
  return item.type === 'divider'
}

/**
 * Меню по WAI-ARIA (menu / menuitem): стрелки вверх-вниз по кругу, Home / End,
 * Enter и пробел выбирают пункт. Esc закрывает панель через стек слоёв.
 */
export function useMenu(emit: MenuEmits) {
  const host = inject(MENU_HOST, null)

  function choose(item: MenuActionItem, e: MouseEvent | KeyboardEvent): void {
    if (item.disabled) return
    emit('click', { key: item.key, domEvent: e })
    host?.close()
  }

  function onKeydown(e: KeyboardEvent): void {
    const list = e.currentTarget as HTMLElement
    const items = [...list.querySelectorAll<HTMLElement>(ITEM)]
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    if (e.key === 'ArrowDown') next = items[(index + 1) % items.length]
    else if (e.key === 'ArrowUp') next = items[index <= 0 ? items.length - 1 : index - 1]
    else if (e.key === 'Home') next = items[0]
    else if (e.key === 'End') next = items[items.length - 1]
    else if (e.key === 'Tab' && host) {
      e.preventDefault()
      host.close()
      return
    }
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  function onItemKeydown(item: MenuActionItem, e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    choose(item, e)
  }

  return { choose, onKeydown, onItemKeydown }
}

/** Первый доступный пункт — ему фокус, когда меню открыли с клавиатуры. */
export function firstMenuItem(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(ITEM)
}
