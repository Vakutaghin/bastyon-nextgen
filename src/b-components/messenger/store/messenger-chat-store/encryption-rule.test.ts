// Шифровать ли сообщение в комнату: личный чат — всегда (и до прихода, и после
// ухода собеседника), группа — по правилу прежнего клиента: публичная и от 50
// участников идут открыто, с причиной для предупреждения в шапке.

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../services/matrix-service', async () => {
  const codec = await import('../../services/matrix-service/address-codec')
  return { matrixService: { hexToAddress: codec.hexToAddress, getClient: () => null } }
})

import { tetatetid } from '../../helpers'
import { GROUP_ENCRYPTION_MEMBER_LIMIT } from '../consts'
import { groupCanBeEncrypted, groupPlaintextReason, roomEncrypts } from './encryption-rule'
import type { MxRoom } from './types'

const ME = '50416c696365'
const PEER = '50426f62626f'
const mxid = (local: string) => `@${local}:matrix.pocketnet.app`

interface FakeRoomOpts {
  name?: string
  joinRule?: string
  members?: Array<{ userId: string; membership: string }>
}

function fakeRoom({ name = '', joinRule, members = [] }: FakeRoomOpts): MxRoom {
  return {
    name,
    currentState: { getMembers: () => members },
    ...(joinRule ? { getJoinRule: () => joinRule } : {}),
  } as unknown as MxRoom
}

/** Личная комната так, как её заводит bastyon-chat: имя — «#» + хэш пары. */
function directRoom(peerMembership: string, joinRule?: string): MxRoom {
  return fakeRoom({
    name: `#${tetatetid(ME, PEER)}`,
    joinRule,
    members: [
      { userId: mxid(ME), membership: 'join' },
      { userId: mxid(PEER), membership: peerMembership },
    ],
  })
}

const memberIds = (n: number) => Array.from({ length: n }, (_, i) => mxid(`u${i}`))

describe('личный чат', () => {
  it('шифруется всегда — групповое правило к нему не применяется', () => {
    // Даже с открытым join rule: групповое правило дало бы открытый текст.
    expect(roomEncrypts(directRoom('join', 'public'), [mxid(ME), mxid(PEER)])).toBe(true)
  })

  it('собеседник лишь приглашён или уже вышел — чат всё ещё личный и шифруется', () => {
    expect(roomEncrypts(directRoom('invite', 'public'), [mxid(ME), mxid(PEER)])).toBe(true)
    expect(roomEncrypts(directRoom('leave', 'public'), [mxid(ME)])).toBe(true)
  })

  it('двое участников, но имя не хэш пары — это группа, и решает групповое правило', () => {
    const pair = fakeRoom({
      name: '@Двое',
      joinRule: 'public',
      members: [
        { userId: mxid(ME), membership: 'join' },
        { userId: mxid(PEER), membership: 'join' },
      ],
    })
    expect(roomEncrypts(pair, [mxid(ME), mxid(PEER)])).toBe(false)
  })
})

describe('группа', () => {
  const closed = fakeRoom({ name: '@Книжный клуб', joinRule: 'invite' })
  const open = fakeRoom({ name: '@Новости', joinRule: 'public' })

  it(`закрытая до ${GROUP_ENCRYPTION_MEMBER_LIMIT - 1} участников шифруется, от ${GROUP_ENCRYPTION_MEMBER_LIMIT} — открытый текст`, () => {
    expect(roomEncrypts(closed, memberIds(GROUP_ENCRYPTION_MEMBER_LIMIT - 1))).toBe(true)
    expect(groupPlaintextReason(closed, GROUP_ENCRYPTION_MEMBER_LIMIT - 1)).toBeNull()

    expect(roomEncrypts(closed, memberIds(GROUP_ENCRYPTION_MEMBER_LIMIT))).toBe(false)
    expect(groupPlaintextReason(closed, GROUP_ENCRYPTION_MEMBER_LIMIT)).toBe('large')
    expect(groupCanBeEncrypted(closed, 500)).toBe(false)
  })

  it('публичная — открытый текст даже втроём; «публичная» важнее «большой»', () => {
    expect(roomEncrypts(open, memberIds(3))).toBe(false)
    expect(groupPlaintextReason(open, 3)).toBe('public')
    expect(groupPlaintextReason(open, 500)).toBe('public')
  })

  it('комната, где пока одна я, шифруется — открытый текст не уйдёт туда, где ждут шифр', () => {
    const alone = fakeRoom({ members: [{ userId: mxid(ME), membership: 'join' }] })
    expect(roomEncrypts(alone, [mxid(ME)])).toBe(true)
  })

  it('без события join rules (SDK его не знает) группа считается закрытой', () => {
    const noRule = fakeRoom({ name: '@Без правил' })
    expect(groupPlaintextReason(noRule, 10)).toBeNull()
    expect(roomEncrypts(noRule, memberIds(10))).toBe(true)
  })

  it('считаются переданные участники, а не загруженные в комнату', () => {
    // В комнате пока видны трое (ленивая загрузка), а участников 60.
    const lazy = fakeRoom({
      name: '@Большой чат',
      joinRule: 'invite',
      members: memberIds(3).map((userId) => ({ userId, membership: 'join' })),
    })
    expect(roomEncrypts(lazy, memberIds(60))).toBe(false)
  })
})
