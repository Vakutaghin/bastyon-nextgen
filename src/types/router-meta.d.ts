/**
 * Расширение типа `RouteMeta` для vue-router.
 * `titleKey` — ключ в словаре локализации (см. src/locales/), используется
 * в `router.afterEach` для подстановки в `document.title`.
 * `embed` — embed-роут (`/embed/...`): рендер без chrome, без восстановления сессии.
 * `helpTopic` — статья справки про этот экран: её открывает F1 (имя файла в help/<язык>/).
 */
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: string
    embed?: boolean
    helpTopic?: string
  }
}
