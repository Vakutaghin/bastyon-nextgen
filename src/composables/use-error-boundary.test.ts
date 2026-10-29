// «Локальное хранилище недоступно» — только когда сломалась наша база. Тот же
// InvalidStateError бросают повторный MediaRecorder.stop() и закрытая база
// Matrix, и раньше они выключали кэш и показывали это предупреждение.

import Dexie from 'dexie'
import type { App } from 'vue'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { warning: h.warning, error: h.error },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { installGlobalErrorHandler } from './use-error-boundary'
import { isDbUnavailable, resetDbAvailabilityForTests } from '@/db/database'

const app = { config: {} } as App
const report = (err: unknown) => app.config.errorHandler!(err, null, 'test')
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('installGlobalErrorHandler', () => {
  beforeAll(() => installGlobalErrorHandler(app))
  beforeEach(() => {
    h.warning.mockReset()
    h.error.mockReset()
  })
  afterAll(() => {
    resetDbAvailabilityForTests()
    consoleError.mockRestore()
  })

  it('повторный stop() у записи — обычная ошибка, кэш продолжает работать', () => {
    report(new DOMException("The MediaRecorder's state is 'inactive'.", 'InvalidStateError'))
    expect(h.warning).not.toHaveBeenCalled()
    expect(h.error).toHaveBeenCalledTimes(1)
    expect(isDbUnavailable()).toBe(false)
  })

  it('закрытая база Matrix — в журнал, без тоста', () => {
    report(
      new DOMException(
        "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
        'InvalidStateError'
      )
    )
    expect(h.warning).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
    expect(isDbUnavailable()).toBe(false)
    expect(consoleError).toHaveBeenLastCalledWith(
      '[error-boundary:vue:test] foreign IndexedDB:',
      expect.any(DOMException)
    )
  })

  it('сломалась наша база — предупреждение один раз, причина в журнале', () => {
    report(new Dexie.DatabaseClosedError())
    report(new Dexie.DatabaseClosedError())
    expect(h.warning).toHaveBeenCalledTimes(1)
    expect(h.warning.mock.calls[0]![0]).toMatchObject({
      message: 'appMsg.error.dbUnavailableTitle',
    })
    expect(h.error).not.toHaveBeenCalled()
    expect(isDbUnavailable()).toBe(true)
    expect(consoleError).toHaveBeenLastCalledWith(
      '[error-boundary:vue:test] local database unavailable:',
      expect.any(Dexie.DatabaseClosedError)
    )
  })
})
