// Удаление чата: вышли и забыли; уже не в комнате — достаточно забыть, а не
// возвращать чат в список. Комнаты, из которых вышли, в списке не показываются.

import { describe, expect, it, vi } from 'vitest'

import { MatrixService } from './matrix-service'

const ROOM = '!a:matrix.pocketnet.app'

const refuse = (errcode: string) => Object.assign(new Error(errcode), { errcode })

function serviceWith(client: Record<string, unknown>) {
  const svc = new MatrixService()
  const removeRoom = vi.fn()
  ;(svc as unknown as { client: unknown }).client = { store: { removeRoom }, ...client }
  return { svc, removeRoom }
}

describe('MatrixService.leaveAndForgetRoom', () => {
  it('вышли и забыли', async () => {
    const leave = vi.fn(async () => ({}))
    const forget = vi.fn(async () => ({}))
    const { svc } = serviceWith({ leave, forget })
    await svc.leaveAndForgetRoom(ROOM)
    expect(leave).toHaveBeenCalledWith(ROOM)
    expect(forget).toHaveBeenCalledWith(ROOM, true)
  })

  it.each(['M_FORBIDDEN', 'M_NOT_FOUND'])('уже не в комнате (%s) — забываем', async (code) => {
    const leave = vi.fn(async () => Promise.reject(refuse(code)))
    const forget = vi.fn(async () => ({}))
    const { svc } = serviceWith({ leave, forget })
    await svc.leaveAndForgetRoom(ROOM)
    expect(forget).toHaveBeenCalledWith(ROOM, true)
  })

  it('комнаты на сервере нет вовсе — убираем у себя', async () => {
    const fail = vi.fn(async () => Promise.reject(refuse('M_NOT_FOUND')))
    const { svc, removeRoom } = serviceWith({ leave: fail, forget: fail })
    await svc.leaveAndForgetRoom(ROOM)
    expect(removeRoom).toHaveBeenCalledWith(ROOM)
  })

  it('вышли, а забыть не вышло — чат удалён', async () => {
    const leave = vi.fn(async () => ({}))
    const forget = vi.fn(async () => Promise.reject(new Error('offline')))
    const { svc, removeRoom } = serviceWith({ leave, forget })
    await svc.leaveAndForgetRoom(ROOM)
    expect(removeRoom).toHaveBeenCalledWith(ROOM)
  })

  it('выйти не вышло (нет связи) или сервер не пускает — ошибка, чат остаётся', async () => {
    const offline = vi.fn(async () => Promise.reject(new Error('offline')))
    const forget = vi.fn(async () => ({}))
    await expect(
      serviceWith({ leave: offline, forget }).svc.leaveAndForgetRoom(ROOM)
    ).rejects.toThrow('offline')
    expect(forget).not.toHaveBeenCalled()

    // 403 на выход, а мы в комнате: сервер забыть её не даёт (400).
    const { svc, removeRoom } = serviceWith({
      leave: vi.fn(async () => Promise.reject(refuse('M_FORBIDDEN'))),
      forget: vi.fn(async () => Promise.reject(refuse('M_UNKNOWN'))),
    })
    await expect(svc.leaveAndForgetRoom(ROOM)).rejects.toThrow('M_UNKNOWN')
    expect(removeRoom).not.toHaveBeenCalled()
  })
})

describe('MatrixService.getRooms', () => {
  it('без комнат, из которых вышли или исключили', () => {
    const room = (roomId: string, membership: string) => ({
      roomId,
      getMyMembership: () => membership,
    })
    const { svc } = serviceWith({
      getRooms: () => [
        room('!join', 'join'),
        room('!invite', 'invite'),
        room('!leave', 'leave'),
        room('!ban', 'ban'),
      ],
    })
    expect(svc.getRooms().map((r) => r.roomId)).toEqual(['!join', '!invite'])
  })
})
