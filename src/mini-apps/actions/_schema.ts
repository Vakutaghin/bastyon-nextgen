/**
 * Zod-схемы параметров для каждого RPC-action.
 *
 * Заменяют legacy `validateParameters` ([index.js:127-135](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L127-L135)),
 * который только проверял `truthy` обязательных полей. Здесь — реальная
 * валидация типов и форм.
 *
 * Каждая схема описывает **только параметры** (`data` в RPC-запросе),
 * а не результат и не permissions. Это структурный контракт.
 *
 * Источник списка actions — `BastyonSdk` в legacy
 * [sdk.js:300-567](../../../../___original-repos/pocketnet.gui/js/lib/apps/sdk.js#L300-L567).
 */

import { z } from 'zod'

/**
 * URL с whitelistом схем `http` / `https`. По умолчанию `z.string().url()`
 * принимает `javascript:`, `data:`, `file:` — что недопустимо для action-ов,
 * передающих URL во встроенные браузеры (`openExternalLink`) или fetch
 * (`authFetch`). Здесь же заодно отсекаем нечеловекочитаемый ввод.
 */
const SafeUrl = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//i.test(s), { message: 'Only http(s) URLs are allowed' })

// Параметры без полей — большинство read-only actions.
const EmptySchema = z.object({}).optional()

// ─── helpers ─────────────────────────────────────────────────────────────────

export const ActionSchemas = {
  // appinfo / userstate / etc — без параметров
  appinfo: EmptySchema,
  account: EmptySchema,
  balance: EmptySchema,
  zaddress: EmptySchema,
  userstate: EmptySchema,
  currency: EmptySchema,
  registration: EmptySchema,
  opensettings: EmptySchema,
  geolocation: EmptySchema,
  getaction: EmptySchema,
  getactions: EmptySchema,
  registerForNotifications: EmptySchema,
  'mobile.camera': EmptySchema,

  // sign
  sign: z.object({ string: z.string().optional() }),

  // authFetch
  authFetch: z.object({
    url: SafeUrl,
    data: z.unknown().optional(),
    method: z.string().max(16).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    /** Опт-ин в legacy формат подписи (без nonce+ttl). По умолчанию используется новый. */
    useOldFormat: z.boolean().optional(),
  }),

  // rpc
  rpc: z.object({
    method: z.string().min(1).max(64),
    parameters: z.array(z.unknown()).optional(),
    options: z
      .object({
        fnode: z.string().optional(),
        cachetime: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  }),

  // payments
  payment: z
    .object({
      recievers: z.array(z.unknown()),
      feemode: z.string().optional(),
    })
    .passthrough(),
  ext: z.object({ ext: z.string().min(1) }),

  // wallet
  fromToTransactions: z.object({
    addressFrom: z.string().min(1),
    addressTo: z.string().min(1),
    update: z.boolean().optional(),
    depth: z.number().int().positive().optional(),
    opreturn: z.boolean().optional(),
    confirmations: z.number().int().nonnegative().optional(),
  }),

  // content
  'get.feed': z.object({}).passthrough().optional(),
  'get.videos': z.object({
    urls: z.array(z.string()),
    update: z.boolean().optional(),
  }),
  'get.videosWithShares': z.object({}).passthrough().optional(),
  'open.post': z.object({ txid: z.string().min(1) }),
  'open.donation': z.object({ receiver: z.string().min(1) }),
  'open.profile': z.object({
    type: z.string().min(1),
    data: z.unknown().optional(),
  }),

  // share + helpers
  share: z
    .object({
      path: z.string().optional(),
      url: z.string().optional(),
      sharing: z.unknown().optional(),
    })
    .passthrough(),
  shareOnBastyon: z
    .object({
      path: z.string().optional(),
      url: z.string().optional(),
      sharing: z.unknown().optional(),
    })
    .passthrough(),
  alert: z.object({ message: z.string().max(2000) }),
  complain: z.object({}).passthrough(),
  channel: z.object({ address: z.string().min(1) }),
  openExternalLink: z.object({ url: SafeUrl }),

  // permissions
  checkPermission: z.object({ permission: z.string().min(1) }),
  requestPermissions: z.object({ permissions: z.array(z.string().min(1)) }),

  // chat
  'chat.getOrCreateRoom': z.object({
    users: z.array(z.string()),
    parameters: z.unknown().optional(),
  }),
  'chat.send': z.object({
    roomid: z.string().min(1),
    content: z.unknown(),
  }),
  'chat.openRoom': z.object({ roomid: z.string().min(1) }),

  // barteron — пробрасываем как passthrough, валидация на стороне barteron-handler
  'barteron.account': z.unknown(),
  'barteron.offer': z.unknown(),
  'barteron.removeOffer': z.unknown(),
  'barteron.comment': z.unknown(),
  'barteron.vote': z.unknown(),

  // media
  'images.upload': z.unknown(),
  'videos.opendialog': z.unknown(),
  'videos.remove': z.unknown(),

  // psdk
  'psdk.userInfoLoad': z.object({
    addresses: z.array(z.string()),
    light: z.boolean().optional(),
    update: z.boolean().optional(),
  }),
} as const satisfies Record<string, z.ZodType>

export type ActionName = keyof typeof ActionSchemas

export const ACTION_NAMES = Object.keys(ActionSchemas) as ActionName[]

export function isKnownAction(name: string): name is ActionName {
  return name in ActionSchemas
}

/**
 * Валидирует `data` входящего RPC по имени action-а.
 * @returns parsed-data при успехе, либо `null` если action неизвестен или data невалидна.
 */
export function parseActionParams<K extends ActionName>(
  action: K,
  data: unknown
): z.infer<(typeof ActionSchemas)[K]> | null {
  const schema = ActionSchemas[action]
  if (!schema) return null
  const result = schema.safeParse(data ?? {})
  return result.success ? (result.data as z.infer<(typeof ActionSchemas)[K]>) : null
}
