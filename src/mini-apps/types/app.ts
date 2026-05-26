/**
 * Минимальное представление установленного мини-приложения.
 *
 * Полная форма (с иконкой, кэшем ресурсов, метриками, состоянием permissions)
 * появится в этапе 3 в `store/apps-store.ts`. Здесь — только то, что нужно
 * bridge'у для маршрутизации сообщений.
 */

import type { ParsedManifest } from './manifest'
import type { PermissionId } from './permissions'

export type AppId = string

/**
 * Откуда приложение взялось в `installed`:
 * - `built-in` — встроенное (см. `registry/built-in.ts`). Не удаляется.
 * - `local` — пользователь явно добавил scope через `addLocal()`. Персистится.
 * - `remote-session` — клик по карточке из каталога: зарегистрирован для bridge,
 *   но не сохраняется на диск. Не показывается в секции «Установленные».
 */
export type AppSource = 'built-in' | 'local' | 'remote-session'

export interface InstalledApp {
  readonly manifest: ParsedManifest

  /**
   * Канонический scope, использованный при установке. Может отличаться от
   * `manifest.scope` (например в dev-режиме это путь к локальной копии).
   * Используется bridge'ом для построения targetOrigin при отправке сообщений.
   */
  readonly scope: string

  /**
   * Опциональный testnet-scope. Когда задан, оба scope считаются валидными
   * источниками сообщений (используется для тестовой версии Barteron и т.п.).
   */
  readonly tscope?: string

  /** URL иконки. Обычно `https://<scope>/b_icon.png`. */
  readonly icon: string

  /** Источник: built-in реестр или локальный пользовательский оверрайд. */
  readonly source: AppSource

  /** Метка времени установки (мс epoch). */
  readonly installedAt: number

  /** `true` для built-ins — пользователь не может удалить. */
  readonly cantdelete?: boolean

  /** Permissions, выданные автоматически (без prompt) при установке. */
  readonly grantedPermissions?: readonly PermissionId[]

  /** Включать ли в сетку мини-приложений. */
  readonly includeInMiniApps?: boolean

  /** Включать ли в поиск Bastyon. */
  readonly includeInSearch?: boolean
}
