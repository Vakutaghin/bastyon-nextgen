/**
 * Barteron: профиль, объявления, отзывы и оценки — транзакции brtaccount,
 * brtoffer, contentDelete, comment и upvoteShare в формате прежнего клиента
 * ([legacy-objects.ts](../tx/legacy-objects.ts), сверено с mainnet).
 *
 * Как у прежнего клиента (`makeAction`): транзакция уходит сразу, без
 * отдельного окна подтверждения, ответ — объект действия с `transaction`
 * (txid); когда она попадёт в блок, приложению придёт событие `action`.
 * Ошибка (нода отказала, нет монет) — отказом промиса с текстом для человека:
 * Barteron показывает `error.message`.
 *
 * Только для встроенного Barteron. Прежний клиент пускал эти действия к любому
 * приложению с правом `account`, но у нас это право описано как «доступ к
 * адресу» — публиковать от имени человека оно не обещает.
 */

import { ActionSchemas } from './_schema'
import { APP_TX_TIMEOUT_MS, type ActionDefinition, type ActionMap } from './types'
import type { InstalledApp } from '../types/app'
import {
  brtAccountObject,
  brtOfferObject,
  commentObject,
  removeObject,
  upvoteShareObject,
  type LegacyTxObject,
} from '../tx/legacy-objects'

export const BARTERON_APP_ID = 'barteron.pocketnet.app'

export class BarteronOnlyError extends Error {
  readonly code = 'barteron_only'
  constructor() {
    super('barteron_only')
    this.name = 'BarteronOnlyError'
  }
}

type Build = (data: unknown, user: string) => LegacyTxObject

function barteronAction(name: keyof typeof ActionSchemas, build: Build): ActionDefinition {
  return {
    schema: ActionSchemas[name],
    permissions: ['account'],
    authorization: true,
    rateLimitClass: 'expensive',
    timeoutMs: APP_TX_TIMEOUT_MS,
    handler: async ({ data, app, host }) => {
      assertBarteron(app)
      const user = host.getUserAddress()
      if (!user) throw new Error('required_authorization')
      return host.sendAppTransaction(app.manifest.id, app.manifest.name, build(data, user))
    },
  }
}

function assertBarteron(app: InstalledApp): void {
  if (app.manifest.id !== BARTERON_APP_ID) throw new BarteronOnlyError()
}

const field = (data: unknown, key: string): unknown =>
  data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined

export const BARTERON_ACTIONS = {
  'barteron.account': barteronAction('barteron.account', brtAccountObject),
  'barteron.offer': barteronAction('barteron.offer', brtOfferObject),
  'barteron.removeOffer': barteronAction('barteron.removeOffer', (data) =>
    removeObject(field(data, 'hash'))
  ),
  'barteron.comment': barteronAction('barteron.comment', (data) => commentObject(data)),
  'barteron.vote': barteronAction('barteron.vote', (data) => upvoteShareObject(data)),
} as const satisfies ActionMap
