/**
 * Account / sign / zaddress / authFetch handlers (этап 5.2).
 *
 * Legacy эквиваленты:
 * - `account` — [index.js:318-334](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L318-L334)
 * - `sign` — [index.js:404-416](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L404-L416)
 * - `zaddress` — [index.js:351-377](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L351-L377)
 * - `authFetch` — [index.js:437-472](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L437-L472)
 *
 * Главное отличие от legacy — `authFetch` теперь по умолчанию использует подпись
 * с nonce+ttl (новый формат `v: 1`), что закрывает §1.14. Старые backend-ы
 * могут опт-инить legacy формат через `data.useOldFormat: true`.
 */

import type { z } from 'zod'
import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'
import type { ApiSignature } from '@/blockchain/types/signatures'
import { appFetch } from '@/helpers/api/fetch-strategies'

interface AccountResult {
  address: string
  signature: ApiSignature | null
  status: unknown
}

const account: ActionDefinition<unknown, AccountResult> = {
  schema: ActionSchemas.account,
  permissions: ['account'],
  authorization: true,
  rateLimitClass: 'cheap',
  handler: async ({ app, host }) => {
    const address = host.getUserAddress()
    if (!address) throw new Error('not_authenticated')
    return {
      address,
      // Подпись над manifest.id — миниаппа получает удостоверение
      // «этот пользователь подписался от имени именно этого приложения».
      signature: host.signApiMessage(app.manifest.id),
      status: host.getCurrentAccountStatus(),
    }
  },
}

const sign: ActionDefinition<{ string?: string }, ApiSignature> = {
  schema: ActionSchemas.sign,
  permissions: ['sign'], // uniq=true — prompt каждый раз
  authorization: true,
  rateLimitClass: 'expensive',
  handler: async ({ data, app, host }) => {
    // Legacy: `(data.string ? data.string + '/' : '') + manifest.id`.
    // Здесь точно так же — иначе backend'ы миниапп не валидируют подпись.
    const payload = (data.string ? `${data.string}/` : '') + app.manifest.id
    const signature = host.signApiMessage(payload)
    if (!signature) throw new Error('not_authenticated')
    return signature
  },
}

/**
 * Детерминированный hash строки в индекс [0, max). 1:1 с legacy `strToNumHash`
 * (`js/functions.js`): сумма (charCode % max) по всем символам, затем `% max`.
 * Должен совпадать с legacy побитно, иначе миниаппа получит другой адрес для
 * того же manifest.id между legacy и nextgen.
 */
function strToNumHash(str: string, max: number): number {
  if (max <= 0) return 0
  let r = 0
  for (let i = 0; i < str.length; i++) {
    r += str.charCodeAt(i) % max
  }
  return r % max
}

const zaddress: ActionDefinition<unknown, string> = {
  schema: ActionSchemas.zaddress,
  permissions: ['zaddress'],
  authorization: true,
  rateLimitClass: 'cheap',
  handler: async ({ app, host }) => {
    // Legacy выбирает один из производных адресов пользователя по hash(manifest.id):
    // `ads[strToNumHash(manifest.id, ads.length - 1)]` (index.js:362-368).
    // «z» в названии — legacy-мисномер: это обычный P2SH-адрес из списка кошельков,
    // а не Zcash sapling z-address.
    const ads = host.getUserWalletAddresses()
    if (!ads.length) {
      throw new Error('broken:zaddresses')
    }
    const index = ads.length > 1 ? strToNumHash(app.manifest.id, ads.length - 1) : 0
    return ads[index]
  },
}

type AuthFetchInput = z.infer<typeof ActionSchemas.authFetch>

const authFetch: ActionDefinition<AuthFetchInput, unknown> = {
  schema: ActionSchemas.authFetch,
  permissions: ['authFetch'],
  authorization: true,
  rateLimitClass: 'expensive',
  handler: async ({ data, app, host, signal }) => {
    // Подпись над manifest.id, как в legacy. Новый формат с nonce+ttl даёт
    // backend-у возможность отвергать replay и устаревшие запросы.
    const signature = host.signApiMessage(app.manifest.id, {
      useOldFormat: data.useOldFormat === true,
    })
    if (!signature) throw new Error('not_authenticated')

    // Приватность/SSRF (P1-8): если манифест объявил fetchHosts — цель обязана
    // быть в allowlist (как в fetch-tunnel). Пустой/отсутствующий список =
    // legacy-поведение (миниаппа ходит на свой backend без ограничения хоста).
    const allowlist = app.manifest.fetchHosts
    if (allowlist && allowlist.length > 0) {
      let originAllowed = false
      try {
        originAllowed = allowlist.includes(new URL(data.url).origin)
      } catch {
        /* невалидный URL — остаётся запрещённым */
      }
      if (!originAllowed) throw new Error('authFetch_forbidden_host')
    }

    // Тело запроса: миниаппа передаёт произвольный data, мы добавляем подпись
    // и сериализуем в JSON. Это формат, который ожидают backend-ы legacy миниапп.
    const bodyData = data.data && typeof data.data === 'object' ? data.data : {}
    const body = { ...(bodyData as Record<string, unknown>), signature }

    // appFetch, а не сырой fetch: торифицирует подписанный запрос (в Tauri) —
    // иначе реальный IP + подпись утекают на app-provided URL мимо Tor (P1-8).
    const res = await appFetch(data.url, {
      method: data.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        ...(data.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal,
      credentials: 'omit',
    })

    if (!res.ok) {
      throw new Error(`authFetch_http_${res.status}`)
    }

    // Возвращаем JSON. Legacy игнорирует non-JSON ответы.
    return res.json()
  },
}

export const ACCOUNT_ACTIONS = {
  account,
  sign,
  zaddress,
  authFetch,
} as const satisfies ActionMap
