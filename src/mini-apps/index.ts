/**
 * Mini-apps host runtime для bastyon-nextgen.
 *
 * Архитектура и план реализации — `_DOCS/MINIAPPS_PLAN.md`.
 * Wire-протокол (контракт совместимости с legacy миниаппами) — см. `types/messages.ts`.
 */

export * from './types'
export * from './core'
export * from './registry'
export * from './store'
export {
  ActionSchemas,
  ACTION_NAMES,
  isKnownAction,
  parseActionParams,
  type ActionName,
} from './actions/_schema'
