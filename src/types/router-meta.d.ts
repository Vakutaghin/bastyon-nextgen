/**
 * Расширение типа `RouteMeta` для vue-router.
 * `titleKey` — ключ в словаре локализации (см. src/locales/), используется
 * в `router.afterEach` для подстановки в `document.title`.
 * `embed` — embed-роут (`/embed/...`): рендер без chrome, без восстановления сессии.
 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: string
    embed?: boolean
  }
}
