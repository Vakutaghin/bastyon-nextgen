/**
 * Управление `document.title` на странице. Шаблон: «{title} — Bastyon».
 *
 * Базовый title задаётся через `meta.title` маршрута в [src/router/index.ts]
 * и применяется в `router.afterEach`. Динамическим страницам (профиль,
 * мини-приложение, транзакция/блок/адрес) композибл позволяет переопределить
 * заголовок реактивно по мере загрузки данных.
 *
 * Пример:
 *   useDocumentTitle(() => profile.value?.name ?? 'Профиль')
 */

import { watch, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const APP_NAME = 'Bastyon'

export function buildDocumentTitle(pageTitle: string | null | undefined): string {
  const trimmed = pageTitle?.trim()
  return trimmed ? `${trimmed} — ${APP_NAME}` : APP_NAME
}

export function setDocumentTitle(pageTitle: string | null | undefined): void {
  document.title = buildDocumentTitle(pageTitle)
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
