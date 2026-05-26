/**
 * Barteron-специфические actions (этап 5.9).
 *
 * Legacy реализации построены на классах `brtAccount`, `brtOffer`, `Comment`,
 * `UpvoteShare`, `Remove` — они конструируют pocketnet-транзакции под
 * barteron-схему и подписывают через wallet UI хоста ([index.js:1027-1108](../../../../___original-repos/pocketnet.gui/js/lib/apps/index.js#L1027-L1108)).
 *
 * В nextgen эти классы ещё не портированы — это большая работа на стыке wallet'а
 * и tx-builder'а. Для v1 возвращаем action-объекты в форме legacy `actionHelper`
 * (`{rejected: true, reason: ...}`), которые barteron-приложение корректно
 * обработает как «пользователь отказался» вместо повисания на ожидании.
 */

import { ActionSchemas } from './_schema'
import type { ActionDefinition, ActionMap } from './types'

const NOT_IMPLEMENTED_RESULT = {
  rejected: true,
  reason: 'barteron_tx_not_implemented_in_nextgen',
} as const

function makeBarteronStub(actionName: string): ActionDefinition<unknown, unknown> {
  return {
    schema: ActionSchemas[actionName as keyof typeof ActionSchemas],
    permissions: ['account'],
    authorization: true,
    rateLimitClass: 'expensive',
    handler: async () => NOT_IMPLEMENTED_RESULT,
  }
}

export const BARTERON_ACTIONS = {
  'barteron.account': makeBarteronStub('barteron.account'),
  'barteron.offer': makeBarteronStub('barteron.offer'),
  'barteron.removeOffer': makeBarteronStub('barteron.removeOffer'),
  'barteron.comment': makeBarteronStub('barteron.comment'),
  'barteron.vote': makeBarteronStub('barteron.vote'),
} as const satisfies ActionMap
