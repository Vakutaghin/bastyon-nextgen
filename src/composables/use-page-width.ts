/**
 * Ширина страницы: колонкой по центру или во весь экран (Настройки → «Общие»
 * и кнопка в шапке).
 *
 * Применяется атрибутом `data-page-width` на `<html>`: он задаёт
 * `--content-max-width` (style.css), по которой выровнены шапка, лента и
 * страницы. Как тема — в `localStorage` и до монтирования приложения, чтобы
 * страница не прыгала по ширине при загрузке. Настройка устройства, не аккаунта.
 */

import { readonly, ref, type Ref } from 'vue'

const STORAGE_KEY = 'bastyon_page_width'

/** `limited` — колонка до 1280 px по центру; `full` — во всю ширину окна. */
export type PageWidth = 'limited' | 'full'

/** По умолчанию — во всю ширину: так ближе всего к прежнему (было до 1600 px). */
export const DEFAULT_PAGE_WIDTH: PageWidth = 'full'

const isPageWidth = (v: unknown): v is PageWidth => v === 'limited' || v === 'full'

function loadStored(): PageWidth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (isPageWidth(raw)) return raw
  } catch {
    /* приватный режим — по умолчанию */
  }
  return DEFAULT_PAGE_WIDTH
}

function apply(width: PageWidth): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-page-width', width)
}

const width: Ref<PageWidth> = ref<PageWidth>(DEFAULT_PAGE_WIDTH)

/** Вызвать один раз при запуске, до монтирования приложения. */
export function initPageWidth(): void {
  width.value = loadStored()
  apply(width.value)
}

export function setPageWidth(next: PageWidth): void {
  width.value = next
  apply(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* приватный режим — не переживёт перезагрузку */
  }
}

export function usePageWidth() {
  return {
    width: readonly(width),
    setWidth: setPageWidth,
    toggle: () => setPageWidth(width.value === 'full' ? 'limited' : 'full'),
  }
}
