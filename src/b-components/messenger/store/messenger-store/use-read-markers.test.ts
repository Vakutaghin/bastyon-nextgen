// Отметка «прочитано»: раз на событие, только с экрана; недошедшая повторяется
// и после закрытия чата — иначе сервер считал прочитанный чат непрочитанным.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  send: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
  events: [] as { getId: () => string }[],
  client: true,
}))
vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getClient: () => (h.client ? { setRoomReadMarkers: h.send } : null),
    getRoom: () => ({ getLiveTimeline: () => ({ getEvents: () => h.events }) }),
  },
}))
vi.mock('@/services/logger', () => ({ logger: { scope: () => ({ debug: vi.fn() }) } }))

import { READ_MARKER_TIMEOUT } from '../consts'
import { useReadMarkers } from './use-read-markers'

const ROOM = '!dm:host'
const event = (id: string) => ({ getId: () => id })

let onScreen = true
const make = () => useReadMarkers({ uiStore: { isChatOnScreen: () => onScreen } } as never)

beforeEach(() => {
  vi.clearAllMocks()
  h.send.mockImplementation(async () => ({}))
  h.events = [event('$1'), event('~local')]
  h.client = true
  onScreen = true
})
afterEach(() => vi.useRealTimers())

describe('отметка «прочитано»', () => {
  it('до последнего события с сервера, раз на событие', async () => {
    const markers = make()
    await markers.markRoomRead(ROOM)
    await markers.markRoomRead(ROOM)
    expect(h.send).toHaveBeenCalledTimes(1)
    expect(h.send).toHaveBeenCalledWith(ROOM, '$1', h.events[0])
    h.events.push(event('$2'))
    await markers.markRoomRead(ROOM)
    expect(h.send).toHaveBeenCalledTimes(2)
  })

  it('чата на экране нет — не уходит', async () => {
    onScreen = false
    await make().markRoomRead(ROOM)
    expect(h.send).not.toHaveBeenCalled()
  })

  it('не дошла — повторяется, когда есть связь, даже если чат уже закрыли', async () => {
    const markers = make()
    h.send.mockRejectedValueOnce(new Error('offline'))
    await markers.markRoomRead(ROOM)
    onScreen = false
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(2)
    expect(h.send).toHaveBeenLastCalledWith(ROOM, '$1', h.events[0])
    await Promise.resolve()
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(2)
  })

  it('ответа нет (сокет умер) — недошедшая; ответа ждёт — второй раз не шлётся', async () => {
    vi.useFakeTimers()
    const markers = make()
    h.send.mockImplementationOnce(() => new Promise(() => {}))
    const run = markers.markRoomRead(ROOM)
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(READ_MARKER_TIMEOUT)
    await run
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(2)
  })

  it('пока не дошла, прочитали дальше — повторять прежнюю незачем', async () => {
    const markers = make()
    let fail!: (e: Error) => void
    h.send.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
    const first = markers.markRoomRead(ROOM)
    h.events.push(event('$2'))
    await markers.markRoomRead(ROOM)
    fail(new Error('offline'))
    await first
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(2)
  })

  it('клиента ещё нет — недошедшая', async () => {
    const markers = make()
    h.client = false
    await markers.markRoomRead(ROOM)
    h.client = true
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(1)
  })

  it('сервер отказал (вышли из чата) — не повторяется; сбой сервера — повторяется', async () => {
    const markers = make()
    h.send.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { httpStatus: 403 }))
    await markers.markRoomRead(ROOM)
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(1)

    h.send.mockRejectedValueOnce(Object.assign(new Error('busy'), { httpStatus: 502 }))
    await markers.markRoomRead(ROOM)
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(3)
  })

  it('вышли из аккаунта — отметки прежнего не повторяются', async () => {
    const markers = make()
    let fail!: (e: Error) => void
    h.send.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
    const run = markers.markRoomRead(ROOM)
    markers.reset()
    fail(new Error('aborted'))
    await run
    markers.flush()
    expect(h.send).toHaveBeenCalledTimes(1)
  })
})
