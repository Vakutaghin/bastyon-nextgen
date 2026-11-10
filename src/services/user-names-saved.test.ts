// Имена между запусками: при запуске поднимаются с устройства, новые копятся и
// уходят на диск пачкой через паузу или сразу, когда приложение сворачивают;
// стирание ждёт идущей записи. База подменена — здесь только порядок работы.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getByPRC = vi.fn()
vi.mock('@/helpers/api/request', () => ({ getByPRC: (...args: unknown[]) => getByPRC(...args) }))

const api = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
}))
vi.mock('@/db/apis/known-users-api', () => ({ knownUsersAPI: api }))

import { __resetUserNamesForTests, rememberUsers, userName } from './user-names'
import {
  SAVE_DELAY_MS,
  __resetSavedUserNamesForTests,
  flushSavedUserNames,
  forgetSavedUserNames,
  startSavedUserNames,
} from './user-names-saved'

const ALICE = 'PJFaWLSPKfRDe4m8gsXg4zfigcVA5yZU2B'
const BOB = 'PRuxZhBhmbDHkefswAWi37yN7b7hFgFEfQ'

function savedAddresses(call = 0): string[] {
  return (api.save.mock.calls[call]![0] as Array<[string, unknown]>).map(([a]) => a)
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetUserNamesForTests()
  __resetSavedUserNamesForTests()
  getByPRC.mockReset().mockResolvedValue([])
  api.load.mockReset().mockResolvedValue([])
  api.save.mockReset().mockResolvedValue(undefined)
  api.clear.mockReset().mockResolvedValue(0)
})

afterEach(() => {
  __resetSavedUserNamesForTests()
  setVisibility('visible')
  vi.useRealTimers()
})

describe('имена между запусками', () => {
  it('сохранённое поднимается при запуске: подпись сразу с ником', async () => {
    api.load.mockResolvedValue([[ALICE, { name: 'SergiyKir', avatar: null }]])
    await startSavedUserNames()
    expect(userName(ALICE)).toBe('SergiyKir')
    // Повторный запуск не читает базу второй раз.
    await startSavedUserNames()
    expect(api.load).toHaveBeenCalledTimes(1)
  })

  it('пришедшее, пока база читается, сохраняется и не перетирается прочитанным', async () => {
    let release: (rows: unknown) => void = () => {}
    api.load.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const started = startSavedUserNames()
    rememberUsers([{ address: ALICE, name: 'NewName' }])
    release([
      [ALICE, { name: 'OldName' }],
      [BOB, { name: 'Leo5591' }],
    ])
    await started
    expect(userName(ALICE)).toBe('NewName')
    expect(userName(BOB)).toBe('Leo5591')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(savedAddresses()).toEqual([ALICE])
  })

  it('новые имена копятся и уходят одной пачкой через паузу', async () => {
    await startSavedUserNames()
    rememberUsers([{ address: ALICE, name: 'SergiyKir' }])
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100)
    rememberUsers([{ address: BOB, name: 'Leo5591' }])
    expect(api.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(savedAddresses()).toEqual([ALICE, BOB])
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3)
    expect(api.save).toHaveBeenCalledTimes(1)
  })

  it('приложение свернули или закрыли — пишем сразу, не дожидаясь паузы', async () => {
    await startSavedUserNames()
    rememberUsers([{ address: ALICE, name: 'SergiyKir' }])
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(savedAddresses()).toEqual([ALICE])

    setVisibility('visible')
    rememberUsers([{ address: BOB, name: 'Leo5591' }])
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(savedAddresses(1)).toEqual([BOB])
    // Таймер паузы снят: третьей записи не будет.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).toHaveBeenCalledTimes(2)
  })

  it('стирание отменяет накопленное и ждёт идущей записи — она не вернёт стёртое', async () => {
    await startSavedUserNames()
    let finishSave: () => void = () => {}
    api.save.mockReturnValueOnce(new Promise<void>((resolve) => (finishSave = resolve)))
    rememberUsers([{ address: ALICE, name: 'SergiyKir' }])
    void flushSavedUserNames()
    rememberUsers([{ address: BOB, name: 'Leo5591' }])

    let forgotten = false
    const forget = forgetSavedUserNames().then(() => (forgotten = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.clear).not.toHaveBeenCalled()
    finishSave()
    await forget
    expect(forgotten).toBe(true)
    expect(api.clear).toHaveBeenCalledTimes(1)
    // Накопленное до стирания (BOB) на диск уже не уйдёт — и со следующей
    // записью тоже.
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).toHaveBeenCalledTimes(1)
    const CAROL = 'PBXC5v3VYuYMCT5nQKNd1VJp2oMqccKtPy'
    rememberUsers([{ address: CAROL, name: 'carol' }])
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(savedAddresses(1)).toEqual([CAROL])
  })

  it('без запуска ничего не сохраняется: база не открылась — кэш живёт в памяти', async () => {
    rememberUsers([{ address: ALICE, name: 'SergiyKir' }])
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(api.save).not.toHaveBeenCalled()
    expect(userName(ALICE)).toBe('SergiyKir')
  })
})
