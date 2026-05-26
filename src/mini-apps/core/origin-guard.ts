/**
 * Origin-валидация входящих сообщений.
 *
 * Legacy использует `String.startsWith` ([index.js:1588-1592](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1588-L1592)),
 * что уязвимо к атакам `example.com.attacker.com`. Здесь — строгое сравнение
 * по `URL.origin` после нормализации scope (закрывает 1.1 и 1.2).
 */

import type { InstalledApp } from '../types/app'

/**
 * Приводит scope (с протоколом или без) к каноническому `https://host[:port]`.
 *
 * Принимает:
 * - `demo.app.com`
 * - `https://demo.app.com`
 * - `https://demo.app.com/index.html`
 * - `https://demo.app.com:8443/path?q=1`
 *
 * Возвращает строго `https://demo.app.com[:port]` (без path/search/hash).
 * Бросает `Error` если scope невалиден.
 */
export function normalizeOrigin(scope: string): string {
  const trimmed = scope.trim()
  if (!trimmed) throw new Error('empty scope')

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withScheme).origin
}

/** Безопасная версия — возвращает `null` вместо исключения. */
export function safeNormalizeOrigin(scope: string | undefined | null): string | null {
  if (!scope) return null
  try {
    return normalizeOrigin(scope)
  } catch {
    return null
  }
}

/**
 * Проверяет что `eventOrigin` принадлежит установленному приложению.
 * Точное равенство `URL.origin`. Поддерживает оба `scope` и `tscope`.
 */
export function matchesOrigin(app: InstalledApp, eventOrigin: string): boolean {
  if (!eventOrigin) return false

  const main = safeNormalizeOrigin(app.scope)
  if (main && main === eventOrigin) return true

  const test = safeNormalizeOrigin(app.tscope)
  if (test && test === eventOrigin) return true

  return false
}

/**
 * Резолвер: ищет установленное приложение по `event.origin`.
 *
 * В этапе 3 будет реализован поверх `apps-store`. Здесь — интерфейс.
 */
export interface AppOriginResolver {
  resolveByOrigin(origin: string): InstalledApp | null
  resolveById(id: string): InstalledApp | null
}

/** In-memory резолвер для тестов и dev-сценариев. */
export function createInMemoryResolver(apps: InstalledApp[]): AppOriginResolver {
  return {
    resolveByOrigin(origin: string): InstalledApp | null {
      if (!origin) return null
      return apps.find((app) => matchesOrigin(app, origin)) ?? null
    },
    resolveById(id: string): InstalledApp | null {
      return apps.find((app) => app.manifest.id === id) ?? null
    },
  }
}
