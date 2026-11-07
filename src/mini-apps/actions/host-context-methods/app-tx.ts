/**
 * HostContext methods: транзакции по просьбе мини-приложений и их действия
 * (`getactions` / `getaction`).
 */

import type { HostContext } from '../host-context'
import type { LegacyTxObject } from '../../tx/legacy-objects'
import {
  appAction,
  appActions,
  exportAction,
  recordSentAction,
  settleAction,
  type AppActionRecord,
} from '../../tx/app-actions'

export type AppTxMethods = Pick<
  HostContext,
  'getAppActions' | 'getAppAction' | 'sendAppTransaction'
>

export interface AppTxDeps {
  getUserAddress: () => string | null
  send: (obj: LegacyTxObject, pending: { title: string }) => Promise<string>
  /** Txid ещё ждёт блока в «песочных часах». */
  isStillPending: (txid: string) => boolean
  /** Транзакция в блоке — по ответу ноды. */
  isConfirmedOnNode: (txid: string) => Promise<boolean>
}

/** Ожидание блока в «песочных часах» — час; дольше ждать нечего. */
const PENDING_DEADLINE_MS = 60 * 60 * 1000

export function createAppTxMethods(deps: AppTxDeps): AppTxMethods {
  /**
   * Ожидающие действия, о которых «песочные часы» уже забыли (подтверждение
   * пришло, пока отслеживание не работало), сверяем с нодой.
   */
  const reconcile = async (records: AppActionRecord[]): Promise<void> => {
    const now = Date.now()
    const stale = records.filter(
      (r) =>
        r.transaction &&
        !r.completed &&
        !r.rejected &&
        (!deps.isStillPending(r.transaction) || now - r.added > PENDING_DEADLINE_MS)
    )
    for (const r of stale.slice(0, 10)) {
      const txid = r.transaction as string
      const confirmed = await deps.isConfirmedOnNode(txid).catch(() => false)
      if (confirmed) settleAction(txid, true)
      else if (now - r.added > PENDING_DEADLINE_MS) settleAction(txid, false)
    }
  }

  return {
    getAppActions: async (appId) => {
      const owner = deps.getUserAddress()
      if (!owner) return []
      await reconcile(appActions(owner, appId))
      return appActions(owner, appId).map(exportAction)
    },

    getAppAction: async (appId, id) => {
      const owner = deps.getUserAddress()
      if (!owner || !id) return null
      const record = appAction(owner, appId, id)
      if (!record) return null
      await reconcile([record])
      return exportAction(record)
    },

    sendAppTransaction: async (appId, appName, obj) => {
      const owner = deps.getUserAddress()
      if (!owner) throw new Error('required_authorization')
      const txid = await deps.send(obj, { title: appName })
      const record = recordSentAction({
        application: appId,
        owner,
        type: obj.type,
        expObject: obj.alias,
        transaction: txid,
      })
      return exportAction(record)
    },
  }
}
