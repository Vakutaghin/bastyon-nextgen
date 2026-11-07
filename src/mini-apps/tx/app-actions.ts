/**
 * Действия мини-приложений — транзакции, которые хост отправил по их просьбе
 * (объявления и отзывы Barteron, платежи). Аналог `app.platform.actions`
 * прежнего клиента в той части, что видят мини-приложения:
 * - `getactions` / `getaction` отдают их приложению — Barteron по ним
 *   показывает в профиле объявления, которые ещё ждут блока;
 * - когда транзакция попала в блок или так и не попала, приложению приходит
 *   событие `action` с тем же объектом (прежний клиент слал его на каждый
 *   новый статус: completed, rejected).
 *
 * Хранятся у пользователя в localStorage по адресу аккаунта: ожидающие — до
 * подтверждения, завершённые — сутки (приложение могло быть закрыто, когда
 * пришёл блок). Ключей и подписей тут нет — только публичные данные транзакций.
 */

import { onTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'

export interface AppActionRecord {
  id: string
  /** manifest.id приложения, по чьей просьбе отправлено. */
  application: string
  /** Адрес аккаунта, от чьего имени. */
  owner: string
  /** Тип транзакции (brtoffer, comment, transaction…). */
  type: string
  /** `export(true)` прежнего клиента — по нему приложение узнаёт свои действия. */
  expObject: Record<string, unknown>
  transaction: string | null
  completed: boolean
  /** Причина отказа; null — не отказано. */
  rejected: string | null
  added: number
  sent: number | null
  updated: number | null
}

const STORAGE_PREFIX = 'BST_MINIAPP_ACTIONS_'
/** Сколько держать завершённые: приложение спросит о них при следующем открытии. */
export const FINISHED_KEEP_MS = 24 * 60 * 60 * 1000
const MAX_RECORDS = 200
/** Прежний клиент давал действию 12 часов (`until`). */
const UNTIL_MS = 12 * 60 * 60 * 1000
/** Отказ, когда транзакция за час так и не попала в блок. */
export const NOT_CONFIRMED = 'notconfirmed'

const byOwner = new Map<string, AppActionRecord[]>()

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function prune(list: AppActionRecord[], now: number): AppActionRecord[] {
  const fresh = list.filter(
    (r) => !(r.completed || r.rejected) || now - (r.updated ?? r.added) < FINISHED_KEEP_MS
  )
  return fresh.slice(-MAX_RECORDS)
}

function load(owner: string): AppActionRecord[] {
  const cached = byOwner.get(owner)
  if (cached) return cached
  let list: AppActionRecord[] = []
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + owner)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      list = parsed.filter(
        (r): r is AppActionRecord =>
          !!r && typeof r.id === 'string' && typeof r.application === 'string'
      )
    }
  } catch {
    list = []
  }
  list = prune(list, Date.now())
  byOwner.set(owner, list)
  return list
}

function save(owner: string): void {
  const list = byOwner.get(owner) ?? []
  try {
    const s = storage()
    if (!s) return
    if (list.length) s.setItem(STORAGE_PREFIX + owner, JSON.stringify(list))
    else s.removeItem(STORAGE_PREFIX + owner)
  } catch {
    // Хранилище недоступно — действия живут до перезапуска.
  }
}

function makeId(): string {
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1)
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

/** Записать отправленную транзакцию как действие приложения. */
export function recordSentAction(input: {
  application: string
  owner: string
  type: string
  expObject: Record<string, unknown>
  transaction: string
}): AppActionRecord {
  const now = Date.now()
  const record: AppActionRecord = {
    id: makeId(),
    application: input.application,
    owner: input.owner,
    type: input.type,
    expObject: input.expObject,
    transaction: input.transaction,
    completed: false,
    rejected: null,
    added: now,
    sent: now,
    updated: null,
  }
  const list = prune([...load(input.owner), record], now)
  byOwner.set(input.owner, list)
  save(input.owner)
  return record
}

/** Действия приложения у аккаунта, старые — первыми. */
export function appActions(owner: string, application: string): AppActionRecord[] {
  return load(owner).filter((r) => r.application === application)
}

export function appAction(owner: string, application: string, id: string): AppActionRecord | null {
  return load(owner).find((r) => r.application === application && r.id === id) ?? null
}

const iso = (ms: number | null): string | null => (ms ? new Date(ms).toISOString() : null)

/**
 * Объект действия в форме `action.export()` прежнего клиента — его ждут SDK
 * (`actionHelper` ставит `relay`/`temp` по `transaction`, `completed`,
 * `rejected`) и сами приложения.
 */
export function exportAction(r: AppActionRecord): Record<string, unknown> {
  return {
    id: r.id,
    priority: 3,
    added: iso(r.added),
    until: iso(r.added + UNTIL_MS),
    sent: iso(r.sent),
    sending: null,
    ttxid: null,
    checkedUntil: null,
    checkConfirmationUntil: null,
    inputs: [],
    outputs: [],
    attempts: 1,
    transaction: r.transaction,
    settings: { application: r.application },
    rejectWait: null,
    rejected: r.rejected,
    completed: r.completed,
    tryingsend: null,
    updated: iso(r.updated),
    keep: false,
    expObject: r.expObject,
  }
}

/**
 * Транзакция в блоке (`confirmed`) или так и не попала в него за час. Возвращает
 * обновлённое действие — его надо отправить приложению событием `action`.
 */
export function settleAction(txid: string, confirmed: boolean): AppActionRecord | null {
  for (const [owner, list] of byOwner) {
    const record = list.find((r) => r.transaction === txid && !r.completed && !r.rejected)
    if (!record) continue
    record.completed = confirmed
    record.rejected = confirmed ? null : NOT_CONFIRMED
    record.updated = Date.now()
    save(owner)
    return record
  }
  return null
}

/**
 * Следить за подтверждениями и сообщать приложениям. `push` — доставка
 * события открытому приложению (закрытое узнает через `getactions`).
 */
export function trackAppActions(
  push: (application: string, key: string, data: Record<string, unknown>) => void,
  currentOwner: () => string | null | undefined
): () => void {
  return onTransactionSettled((txid, confirmed) => {
    // После перезапуска подтверждение приходит раньше, чем приложение спросит
    // свои действия: поднимаем их из хранилища здесь.
    const owner = currentOwner()
    if (owner) load(owner)
    const record = settleAction(txid, confirmed)
    if (record) push(record.application, 'action', exportAction(record))
  })
}

/** Только для тестов. */
export function _resetAppActionsForTests(): void {
  byOwner.clear()
}
