/**
 * Permissions registry для мини-приложений.
 *
 * Идентификаторы и метаданные сохранены 1-в-1 с legacy
 * [index.js:162-242](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L162-L242)
 * — менять их нельзя, на них завязан wire-протокол.
 */

export const PERMISSION_IDS = [
  'account',
  'authFetch',
  'sign',
  'messaging',
  'mobilecamera',
  'payment',
  'chat',
  'geolocation',
  'externallink',
  'zaddress',
  'notifications',
] as const

export type PermissionId = (typeof PERMISSION_IDS)[number]

/**
 * Метаданные permission. Семантика полей:
 * - `level` — приоритет/чувствительность (1=минимальный, 9=максимальный). Используется
 *   для сортировки UI и группировки.
 * - `uniq` — спрашивать каждый раз заново, не запоминать grant.
 * - `auto` — выдаётся без явного prompt при первом обращении.
 * - `session` — grant живёт только до конца сессии, не персистится.
 * - `ensure` — async-проверка реального состояния разрешения у внешней системы
 *   (например у Firebase для notifications). Если резолвится true — permission
 *   считается granted без prompt.
 */
export interface PermissionMeta {
  readonly id: PermissionId
  readonly level: 1 | 2 | 4 | 5 | 9
  readonly uniq?: boolean
  readonly auto?: boolean
  readonly session?: boolean
  readonly nameKey: string
  readonly descriptionKey: string
}

export const PERMISSIONS: Readonly<Record<PermissionId, PermissionMeta>> = {
  account: {
    id: 'account',
    level: 5,
    nameKey: 'permissions_name_account',
    descriptionKey: 'permissions_descriptions_account',
  },
  authFetch: {
    id: 'authFetch',
    level: 5,
    nameKey: 'permissions_auth_fetch',
    descriptionKey: 'permissions_auth_fetch',
  },
  sign: {
    id: 'sign',
    level: 1,
    uniq: true,
    nameKey: 'permissions_name_sign',
    descriptionKey: 'permissions_descriptions_sign',
  },
  messaging: {
    id: 'messaging',
    level: 9,
    auto: true,
    nameKey: 'permissions_name_messaging',
    descriptionKey: 'permissions_descriptions_messaging',
  },
  mobilecamera: {
    id: 'mobilecamera',
    level: 9,
    auto: true,
    nameKey: 'permissions_name_mobilecamera',
    descriptionKey: 'permissions_descriptions_mobilecamera',
  },
  payment: {
    id: 'payment',
    level: 2,
    uniq: true,
    nameKey: 'permissions_name_payment',
    descriptionKey: 'permissions_descriptions_payment',
  },
  chat: {
    id: 'chat',
    level: 2,
    nameKey: 'permissions_name_chat',
    descriptionKey: 'permissions_descriptions_chat',
  },
  geolocation: {
    id: 'geolocation',
    level: 2,
    session: true,
    nameKey: 'permissions_name_geolocation',
    descriptionKey: 'permissions_descriptions_geolocation',
  },
  externallink: {
    id: 'externallink',
    level: 1,
    nameKey: 'permissions_name_externallink',
    descriptionKey: 'permissions_descriptions_externallink',
  },
  zaddress: {
    id: 'zaddress',
    level: 4,
    nameKey: 'permissions_name_zaddress',
    descriptionKey: 'permissions_descriptions_zaddress',
  },
  notifications: {
    id: 'notifications',
    level: 9,
    nameKey: 'permissions_name_notifications',
    descriptionKey: 'permissions_descriptions_notifications',
  },
}

export function isKnownPermission(id: string): id is PermissionId {
  return (PERMISSION_IDS as readonly string[]).includes(id)
}
