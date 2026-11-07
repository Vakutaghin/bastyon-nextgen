import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { notifyTransactionSettled } from '@/blockchain/core/transactions/broadcast-events'
import {
  FINISHED_KEEP_MS,
  NOT_CONFIRMED,
  _resetAppActionsForTests,
  appAction,
  appActions,
  exportAction,
  recordSentAction,
  trackAppActions,
} from './app-actions'

const OWNER = 'PUser'
const APP = 'barteron.pocketnet.app'
const TX = 'e'.repeat(64)

const sent = (over: Partial<Parameters<typeof recordSentAction>[0]> = {}) =>
  recordSentAction({
    application: APP,
    owner: OWNER,
    type: 'brtoffer',
    expObject: { address: OWNER, hash: null, caption: 'Велосипед' },
    transaction: TX,
    ...over,
  })

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  _resetAppActionsForTests()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('app-actions', () => {
  it('отправленное — в действиях приложения, в форме action.export() прежнего клиента', () => {
    const record = sent()
    const exported = exportAction(record)
    expect(exported).toMatchObject({
      id: record.id,
      transaction: TX,
      completed: false,
      rejected: null,
      settings: { application: APP },
      expObject: { address: OWNER, caption: 'Велосипед' },
    })
    expect(typeof exported.added).toBe('string')
    expect(appActions(OWNER, APP).map((r) => r.id)).toEqual([record.id])
    expect(appAction(OWNER, APP, record.id)).toBe(record)
  })

  it('чужие действия приложению не видны — ни другого приложения, ни другого аккаунта', () => {
    sent({ application: 'other.app' })
    sent({ owner: 'POther' })
    expect(appActions(OWNER, APP)).toEqual([])
  })

  it('блок — действие завершено, приложению уходит событие action', () => {
    const push = vi.fn()
    const stop = trackAppActions(push, () => OWNER)
    const record = sent()
    notifyTransactionSettled(TX, true)
    expect(push).toHaveBeenCalledWith(
      APP,
      'action',
      expect.objectContaining({ id: record.id, completed: true, rejected: null })
    )
    expect(appAction(OWNER, APP, record.id)?.completed).toBe(true)
    stop()
  })

  it('за час не попала в блок — отказ notconfirmed', () => {
    const push = vi.fn()
    const stop = trackAppActions(push, () => OWNER)
    sent()
    notifyTransactionSettled(TX, false)
    expect(push).toHaveBeenCalledWith(
      APP,
      'action',
      expect.objectContaining({ completed: false, rejected: NOT_CONFIRMED })
    )
    stop()
  })

  it('чужая транзакция — никому ничего', () => {
    const push = vi.fn()
    const stop = trackAppActions(push, () => OWNER)
    sent()
    notifyTransactionSettled('f'.repeat(64), true)
    expect(push).not.toHaveBeenCalled()
    stop()
  })

  it('переживает перезапуск: подтверждение до первого запроса приложения находит действие', () => {
    const record = sent()
    _resetAppActionsForTests() // «перезапуск»: в памяти пусто, в хранилище есть
    const push = vi.fn()
    const stop = trackAppActions(push, () => OWNER)
    notifyTransactionSettled(TX, true)
    expect(push).toHaveBeenCalledWith(APP, 'action', expect.objectContaining({ id: record.id }))
    stop()
  })

  it('завершённые держатся сутки, ожидающие — пока не решится', () => {
    vi.useFakeTimers()
    const done = sent({ transaction: 'a'.repeat(64) })
    const waiting = sent({ transaction: 'b'.repeat(64) })
    const stop = trackAppActions(vi.fn(), () => OWNER)
    notifyTransactionSettled('a'.repeat(64), true)
    stop()
    vi.advanceTimersByTime(FINISHED_KEEP_MS + 1)
    _resetAppActionsForTests()
    expect(appActions(OWNER, APP).map((r) => r.id)).toEqual([waiting.id])
    expect(appAction(OWNER, APP, done.id)).toBeNull()
  })
})
