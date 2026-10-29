// Новый личный чат: комната отдаётся, когда синк принёс и собеседника. Синк
// может принести её посреди создания — с именем и алиасом, но без приглашения,
// и первое сообщение уходило групповым ключом для одного отправителя.

import { describe, expect, it, vi } from 'vitest'

import { MatrixService } from './matrix-service'

const ME = '@50416c696365:matrix.pocketnet.app'
const BOB = '@50426f62:matrix.pocketnet.app'

/** Комната, какой её видит клиент по мере синка: участники и наше вступление. */
function roomWith(members: Record<string, string>) {
  return {
    getMyMembership: () => members[ME] ?? 'leave',
    getMember: (id: string) => (members[id] ? { membership: members[id] } : null),
  }
}

describe('MatrixService.waitForMember', () => {
  it('собеседник приглашён или вступил, мы вступили — true', async () => {
    const members: Record<string, string> = { [ME]: 'join' }
    setTimeout(() => (members[BOB] = 'invite'), 30)
    await expect(MatrixService.waitForMember(() => roomWith(members), BOB, 1000, 5)).resolves.toBe(
      true
    )
    await expect(
      MatrixService.waitForMember(() => roomWith({ [ME]: 'join', [BOB]: 'join' }), BOB, 30, 5)
    ).resolves.toBe(true)
  })

  it('собеседника нет, мы не вступили или комнаты нет — false, без исключений', async () => {
    await expect(
      MatrixService.waitForMember(() => roomWith({ [ME]: 'join' }), BOB, 30, 5)
    ).resolves.toBe(false)
    await expect(
      MatrixService.waitForMember(() => roomWith({ [ME]: 'invite', [BOB]: 'join' }), BOB, 30, 5)
    ).resolves.toBe(false)
    await expect(
      MatrixService.waitForMember(() => roomWith({ [ME]: 'join', [BOB]: 'leave' }), BOB, 30, 5)
    ).resolves.toBe(false)
    await expect(MatrixService.waitForMember(() => null, BOB, 30, 5)).resolves.toBe(false)
  })
})

describe('MatrixService.createDirectRoom', () => {
  function serviceWith(members: Record<string, string>) {
    const client = {
      getUserId: () => ME,
      createRoom: vi.fn(async () => ({ room_id: '!new:matrix.pocketnet.app' })),
      getRoom: vi.fn(() => roomWith(members)),
    }
    const svc = new MatrixService()
    ;(svc as unknown as { client: typeof client }).client = client
    return { svc, client }
  }

  it('синк принёс комнату без приглашения — ответ ждёт собеседника в комнате', async () => {
    const members: Record<string, string> = { [ME]: 'join' }
    const { svc, client } = serviceWith(members)
    let roomId: string | null | undefined
    const creating = svc.createDirectRoom(BOB).then((id) => (roomId = id))
    await vi.waitFor(() => expect(client.createRoom).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(roomId).toBeUndefined()

    members[BOB] = 'invite'
    await creating
    expect(roomId).toBe('!new:matrix.pocketnet.app')
    expect(client.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ invite: [BOB], is_direct: true })
    )
  })

  it('комната уже полная — без ожидания', async () => {
    const { svc } = serviceWith({ [ME]: 'join', [BOB]: 'invite' })
    const started = Date.now()
    await expect(svc.createDirectRoom(BOB)).resolves.toBe('!new:matrix.pocketnet.app')
    expect(Date.now() - started).toBeLessThan(100)
  })
})
