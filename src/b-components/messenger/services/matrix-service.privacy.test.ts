// Приватность в чатах на уровне клиента Matrix: «в сети» переключается без
// перезапуска синка, «записывает голосовое» уходит to-device участникам
// комнаты, чужое присутствие — только если сервер его прислал.

import { describe, expect, it, vi } from 'vitest'

import { MatrixService } from './matrix-service'
import { RECORDING_EVENT, RECORDING_MAX_RECIPIENTS } from '../lib/chat-privacy'

const ME = '@me:matrix.pocketnet.app'
const BOB = '@bob:matrix.pocketnet.app'
const ANN = '@ann:matrix.pocketnet.app'

function serviceWith(client: Record<string, unknown>) {
  const svc = new MatrixService()
  ;(svc as unknown as { client: unknown }).client = client
  return svc
}

describe('MatrixService.setPresenceVisible', () => {
  it('до входа только запоминает: первый синк уйдёт уже с нужным set_presence', async () => {
    const svc = new MatrixService()
    await svc.setPresenceVisible(true)
    expect((svc as unknown as { presenceVisible: boolean }).presenceVisible).toBe(true)
  })

  it('у работающего клиента меняет параметр синка и ставит статус сразу', async () => {
    const syncApi = { opts: { disablePresence: true } }
    const client = {
      syncApi,
      setSyncPresence: vi.fn(async () => {}),
      setPresence: vi.fn(async () => {}),
    }
    const svc = serviceWith(client)

    await svc.setPresenceVisible(true)
    expect(syncApi.opts.disablePresence).toBe(false)
    expect(client.setSyncPresence).toHaveBeenLastCalledWith('online')
    expect(client.setPresence).toHaveBeenLastCalledWith({ presence: 'online' })

    await svc.setPresenceVisible(false)
    expect(syncApi.opts.disablePresence).toBe(true)
    expect(client.setPresence).toHaveBeenLastCalledWith({ presence: 'offline' })
  })

  it('сервер без присутствия — не ошибка', async () => {
    const client = {
      setSyncPresence: vi.fn(async () => {}),
      setPresence: vi.fn(async () => {
        throw new Error('presence disabled')
      }),
    }
    await expect(serviceWith(client).setPresenceVisible(true)).resolves.toBeUndefined()
  })
})

describe('MatrixService.getUserPresence', () => {
  const svcWithUser = (user: unknown) => serviceWith({ getUser: () => user })

  it('в сети, был в сети, ничего не известно', () => {
    expect(
      svcWithUser({ presence: 'online', lastPresenceTs: 1000, lastActiveAgo: 0 }).getUserPresence(
        BOB
      )
    ).toEqual({ online: true, lastActiveAt: null })
    expect(
      svcWithUser({
        presence: 'offline',
        lastPresenceTs: 10_000,
        lastActiveAgo: 4000,
      }).getUserPresence(BOB)
    ).toEqual({ online: false, lastActiveAt: 6000 })
    // Сервер ничего не присылал (прежний клиент, выключено у собеседника).
    expect(svcWithUser({ presence: 'offline', lastPresenceTs: 0 }).getUserPresence(BOB)).toBeNull()
    expect(svcWithUser(null).getUserPresence(BOB)).toBeNull()
  })
})

describe('MatrixService.sendRecording', () => {
  function clientWith(members: string[]) {
    return {
      getUserId: () => ME,
      getRoom: () => ({ getJoinedMembers: () => members.map((userId) => ({ userId })) }),
      sendToDevice: vi.fn(async () => ({})),
    }
  }

  it('всем участникам, кроме себя, на все устройства', async () => {
    const client = clientWith([ME, BOB, ANN])
    await serviceWith(client).sendRecording('!room:x', true)
    expect(client.sendToDevice).toHaveBeenCalledTimes(1)
    const [type, map] = client.sendToDevice.mock.calls[0] as unknown as [
      string,
      Map<string, Map<string, unknown>>,
    ]
    expect(type).toBe(RECORDING_EVENT)
    expect([...map.keys()]).toEqual([BOB, ANN])
    expect(map.get(BOB)!.get('*')).toEqual({ room_id: '!room:x', recording: true })
  })

  it('в комнате один я или участников слишком много — никому', async () => {
    const alone = clientWith([ME])
    await serviceWith(alone).sendRecording('!room:x', true)
    expect(alone.sendToDevice).not.toHaveBeenCalled()

    const crowd = clientWith([
      ME,
      ...Array.from({ length: RECORDING_MAX_RECIPIENTS + 1 }, (_, i) => `@u${i}:x`),
    ])
    await serviceWith(crowd).sendRecording('!room:x', true)
    expect(crowd.sendToDevice).not.toHaveBeenCalled()
  })
})
