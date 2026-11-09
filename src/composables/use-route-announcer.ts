/**
 * Смена страницы для диктора: в одностраничном приложении браузер страницу не
 * перезагружает, и TalkBack, VoiceOver или NVDA молчат — человек не знает,
 * что нажатие сработало. После перехода на другой адрес произносим название
 * новой страницы (то же, что во вкладке, без числа непрочитанных).
 *
 * Фокус не переносим: так вёл себя интерфейс и раньше, а к содержимому
 * ведёт ссылка «Перейти к содержимому». Смена вкладки ленты или фильтра
 * (тот же путь, другой query) не объявляется — это не новая страница.
 */

import { onBeforeUnmount } from 'vue'
import type { Router } from 'vue-router'

import { announce } from '@/helpers/a11y/announce'
import { pageTitleForSpeech } from '@/composables/use-document-title'

/** Ждём, пока страница поставит свой заголовок (профиль — ник после загрузки). */
export const ROUTE_ANNOUNCE_DELAY_MS = 700

export function watchRouteAnnouncements(router: Router): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const off = router.afterEach((to, from, failure) => {
    // Первый переход при запуске: заголовок вкладки диктор прочтёт сам.
    if (failure || from.matched.length === 0 || to.path === from.path) return
    clearTimeout(timer)
    timer = setTimeout(() => announce(pageTitleForSpeech()), ROUTE_ANNOUNCE_DELAY_MS)
  })
  return () => {
    clearTimeout(timer)
    off()
  }
}

export function useRouteAnnouncer(router: Router): void {
  onBeforeUnmount(watchRouteAnnouncements(router))
}
