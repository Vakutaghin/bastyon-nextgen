/**
 * Приём системных ссылок `bastyon://…` (deep links) на всех платформах.
 *
 * Пути доставки разные, обработка одна (`resolveDeepLink` → `router.replace`):
 *  - **Tauri (macOS/Windows/Linux)** — plugin-deep-link: `onOpenUrl` для уже
 *    запущенного приложения и `getCurrent()` для холодного старта (на Windows
 *    и Linux ссылка приходит аргументом командной строки).
 *  - **Android / iOS** — Capacitor App: `appUrlOpen` и `getLaunchUrl()`.
 *  - **Веб / PWA** — браузер не даёт зарегистрировать произвольную схему:
 *    `registerProtocolHandler` принимает только `web+…`. Поэтому установленное
 *    PWA регистрируется на `web+bastyon:` и получает ссылку параметром
 *    `?deeplink=` (см. `protocol_handlers` в манифесте).
 *
 * Навигация — `replace`, а не `push`: deep link открывает приложение, и «назад»
 * не должно возвращать на пустой стартовый экран.
 */

import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { isTauriEnv } from '@/helpers/api/request-tor'
import { resolveDeepLink } from '@/helpers/common/deep-link'
import { logger } from '@/services/logger'

const log = logger.scope('[deep-link]')

/** Параметр, которым PWA-обработчик протокола передаёт исходную ссылку. */
export const DEEP_LINK_QUERY_PARAM = 'deeplink'
/** Схема для браузеров: произвольные схемы `registerProtocolHandler` запрещает. */
const WEB_PROTOCOL = 'web+bastyon'

function navigate(router: Router, rawUrl: string): void {
  const path = resolveDeepLink(rawUrl)
  if (!path) {
    log.debug('ignored', rawUrl)
    return
  }
  log.debug('open', rawUrl, '→', path)
  void router.replace(path)
}

/** Схемы, которые приложение готово открывать. */
const APP_SCHEME_NAMES = ['bastyon', 'pocketnet']

/**
 * Windows и Linux регистрируют схему не бандлером, а самим приложением: на
 * macOS это делает `CFBundleURLTypes` бандла, а здесь нужен явный `register`
 * (плагин пишет ключ реестра / `.desktop` + xdg-mime). Идемпотентно и
 * безвредно: на macOS команда просто не поддерживается.
 */
async function ensureSchemesRegistered(
  mod: typeof import('@tauri-apps/plugin-deep-link')
): Promise<void> {
  for (const scheme of APP_SCHEME_NAMES) {
    try {
      if (await mod.isRegistered(scheme)) continue
      await mod.register(scheme)
      log.debug('registered scheme', scheme)
    } catch (e) {
      log.debug('scheme registration skipped', scheme, e)
    }
  }
}

/** Tauri: события плагина + ссылка, с которой приложение запустили. */
async function setupTauri(router: Router): Promise<void> {
  const mod = await import('@tauri-apps/plugin-deep-link')
  await mod.onOpenUrl((urls) => {
    const first = urls[0]
    if (first) navigate(router, first)
  })

  await ensureSchemesRegistered(mod)

  try {
    const initial = await mod.getCurrent()
    const first = initial?.[0]
    if (first) navigate(router, first)
  } catch (e) {
    // На Linux/Windows getCurrent читает argv — там бывает пусто или мусор.
    log.debug('getCurrent failed', e)
  }
}

/** Capacitor: ссылка при запуске и пока приложение живо. */
async function setupCapacitor(router: Router): Promise<void> {
  const { App } = await import('@capacitor/app')
  await App.addListener('appUrlOpen', ({ url }) => navigate(router, url))

  const launch = await App.getLaunchUrl()
  if (launch?.url) navigate(router, launch.url)
}

/**
 * Веб: разбираем `?deeplink=` и предлагаем браузеру запомнить нас обработчиком
 * `web+bastyon:`. Тихо игнорируем отказ — это не критичный путь.
 */
function setupWeb(router: Router): void {
  const params = new URLSearchParams(window.location.search)
  const incoming = params.get(DEEP_LINK_QUERY_PARAM)
  if (incoming) navigate(router, incoming)

  try {
    navigator.registerProtocolHandler?.(
      WEB_PROTOCOL,
      `${window.location.origin}/?${DEEP_LINK_QUERY_PARAM}=%s`
    )
  } catch (e) {
    log.debug('registerProtocolHandler refused', e)
  }
}

/** Подписывает приложение на системные ссылки. Идемпотентна. */
let started = false

export async function setupDeepLinks(router: Router): Promise<void> {
  if (started || typeof window === 'undefined') return
  started = true

  try {
    if (isTauriEnv()) {
      await setupTauri(router)
      return
    }
    if (Capacitor.isNativePlatform()) {
      await setupCapacitor(router)
      return
    }
    setupWeb(router)
  } catch (e) {
    log.warn('setup failed', e)
  }
}

/** Только для тестов: разрешить повторную инициализацию. */
export function resetDeepLinksForTests(): void {
  started = false
}
