/**
 * Управление `document.title` на странице. Шаблон: «{title} — Bastyon NextGen».
 *
 * Базовый title задаётся через `meta.title` маршрута в [src/router/index.ts]
 * и применяется в `router.afterEach`. Динамическим страницам (профиль,
 * мини-приложение, транзакция/блок/адрес) композибл позволяет переопределить
 * заголовок реактивно по мере загрузки данных.
 *
 * Пример:
 *   useDocumentTitle(() => profile.value?.name ?? 'Профиль')
 *
 * Непрочитанные сообщения — числом впереди: «(3) Лента — Bastyon NextGen», как
 * у мессенджеров во вкладке браузера (`useAppBadge`).
 */

import { watch, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { APP_NAME } from '@/config/app-name'

/** Последний заголовок страницы и число непрочитанных — меняются независимо. */
let currentPageTitle: string | null | undefined = null
let currentUnread = 0

export function buildDocumentTitle(pageTitle: string | null | undefined, unread = 0): string {
  const trimmed = pageTitle?.trim()
  const base = trimmed ? `${trimmed} — ${APP_NAME}` : APP_NAME
  if (unread <= 0) return base
  return `(${unread > 99 ? '99+' : unread}) ${base}`
}

export function setDocumentTitle(pageTitle: string | null | undefined): void {
  currentPageTitle = pageTitle
  document.title = buildDocumentTitle(pageTitle, currentUnread)
}

/** Число непрочитанных в заголовке; 0 — без него. */
export function setDocumentTitleUnread(unread: number): void {
  if (unread === currentUnread) return
  currentUnread = unread
  document.title = buildDocumentTitle(currentPageTitle, unread)
}

export function useDocumentTitle(title: MaybeRefOrGetter<string | null | undefined>): void {
  watch(
    () => toValue(title),
    (value) => {
      setDocumentTitle(value)
    },
    { immediate: true }
  )
}
