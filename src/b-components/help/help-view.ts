// Общее для отрисовки статьи: страница справки и боковая панель по-разному
// переходят по ссылкам (страница — через адрес, панель — внутри себя), а
// компоненты статьи получают это через provide/inject, не передавая по цепочке.
import { inject, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import type { HelpLibrary, HelpLinkTarget } from '@/helpers/help/help-types'

export interface HelpView {
  library: ShallowRef<HelpLibrary | null>
  /** Основы слов из поиска — подсвечиваются в тексте статьи. */
  highlight: Ref<readonly string[]>
  navigate: (target: HelpLinkTarget) => void
}

export const HELP_VIEW: InjectionKey<HelpView> = Symbol('help-view')

export function useHelpView(): HelpView {
  const view = inject(HELP_VIEW)
  if (!view) throw new Error('help article outside of a help view')
  return view
}

/** Адрес ссылки: для «открыть в новой вкладке» и копирования. */
export function helpHref(target: HelpLinkTarget): string {
  switch (target.kind) {
    case 'home':
      return '/help'
    case 'topic':
      return `/help/${target.topic}${target.anchor ? `#${encodeURIComponent(target.anchor)}` : ''}`
    case 'term':
      return `/help/glossary#${encodeURIComponent(target.anchor)}`
    case 'app':
      return target.path
    case 'external':
      return target.href
    case 'broken':
      return ''
  }
}

/** Адрес статьи в справке. */
export function topicPath(id: string, anchor?: string | null): string {
  return helpHref({ kind: 'topic', topic: id, anchor: anchor ?? null })
}

/**
 * Раздел статьи по якорю: `id` заголовка (из текста, у каждого языка свой) или
 * метка раздела `data-help-key` — она одна на всех языках.
 */
export function findHelpSection(root: ParentNode, anchor: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[id], [data-help-key]')) {
    if (el.id === anchor || el.dataset.helpKey === anchor) return el
  }
  return null
}
