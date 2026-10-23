import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
}))

import {
  groupAvatarSrc,
  groupMembers,
  groupRoomName,
  groupTopic,
  membersTitle,
  previewMemberIds,
  readGroupState,
  sortGroupMembers,
  type GroupRoomLike,
} from './group-chat'

const mxc = (u: string) => `https://mx.host/thumb/${u.slice(6)}`

function room(
  state: Record<string, Record<string, unknown>>,
  members: Array<{ userId: string; membership?: string; powerLevel?: number }> = [],
  joinRule = 'invite'
): GroupRoomLike {
  return {
    currentState: {
      getStateEvents: (type) => (state[type] ? { getContent: () => state[type] } : null),
      getMembers: () => members,
    },
    getJoinRule: () => joinRule,
  }
}

describe('group-chat', () => {
  it('название: без «@» прежнего клиента; имя-хэш личной комнаты — не название', () => {
    expect(groupRoomName('@Клуб любителей')).toBe('Клуб любителей')
    expect(groupRoomName('@@Двойной')).toBe('Двойной')
    expect(groupRoomName('Element room')).toBe('Element room')
    expect(groupRoomName(`#${'a'.repeat(56)}`)).toBe('')
    expect(groupRoomName(undefined)).toBe('')
  })

  it('описание: «_» прежнего клиента — пробелы', () => {
    expect(groupTopic('Про_всё_на_свете')).toBe('Про всё на свете')
    expect(groupTopic(42)).toBe('')
  })

  it('картинка: data:-строка прежнего клиента, хэш картинки, mxc', () => {
    expect(groupAvatarSrc({ avatarUrl: 'data:image/jpeg;base64,/9j/' }, mxc)).toBe(
      'data:image/jpeg;base64,/9j/'
    )
    expect(groupAvatarSrc({ avatarUrl: 'https://bastyon.com:8092/i/abc' }, mxc)).toBe(
      'https://pocketnet.app:8092/i/abc'
    )
    expect(groupAvatarSrc({ url: 'mxc://host/id' }, mxc)).toBe('https://mx.host/thumb/host/id')
    expect(groupAvatarSrc({ avatarUrl: '' }, mxc)).toBeUndefined()
    expect(groupAvatarSrc({}, mxc)).toBeUndefined()
  })

  it('состояние группы целиком', () => {
    expect(
      readGroupState(
        room({ 'm.room.name': { name: '@Team' }, 'm.room.topic': { topic: 'a_b' } }, [], 'public'),
        mxc
      )
    ).toEqual({ name: 'Team', topic: 'a b', avatar: undefined, isPublic: true })
  })

  it('участники: вступившие и приглашённые с ролями из power_levels', () => {
    const r = room(
      { 'm.room.power_levels': { users: { '@a:h': 100, '@b:h': 50 }, users_default: 0 } },
      [
        { userId: '@a:h', membership: 'join' },
        { userId: '@b:h', membership: 'join' },
        { userId: '@c:h', membership: 'invite', powerLevel: 0 },
        { userId: '@d:h', membership: 'leave' },
        { userId: '@e:h', membership: 'ban' },
      ]
    )
    expect(groupMembers(r)).toEqual([
      { id: '@a:h', membership: 'join', role: 'admin' },
      { id: '@b:h', membership: 'join', role: 'moderator' },
      { id: '@c:h', membership: 'invite', role: null },
    ])
  })

  it('без power_levels — уровень участника из SDK', () => {
    const r = room({}, [{ userId: '@a:h', membership: 'join', powerLevel: 100 }])
    expect(groupMembers(r)[0]?.role).toBe('admin')
  })

  it('мозаика: не себя, сначала вступивших, не больше четырёх', () => {
    const list = [
      { id: '@me:h', membership: 'join' as const, role: null },
      { id: '@i:h', membership: 'invite' as const, role: null },
      ...['@1:h', '@2:h', '@3:h', '@4:h'].map((id) => ({
        id,
        membership: 'join' as const,
        role: null,
      })),
    ]
    expect(previewMemberIds(list, '@me:h')).toEqual(['@1:h', '@2:h', '@3:h', '@4:h'])
    expect(previewMemberIds(list.slice(0, 3), '@me:h')).toEqual(['@1:h', '@i:h'])
  })

  it('группа без названия: до трёх имён и «и ещё N»', () => {
    expect(membersTitle(['Аня', 'Боря'], 2)).toBe('Аня, Боря')
    expect(membersTitle(['Аня', 'Боря', 'Вика', 'Гоша'], 7)).toBe(
      'messenger.group.andMore {"names":"Аня, Боря, Вика","n":4}'
    )
    expect(membersTitle([], 0)).toBe('messenger.group.untitled')
  })

  it('порядок: админы, модераторы, остальные по имени, приглашённые в конце', () => {
    const m = (
      name: string,
      role: 'admin' | 'moderator' | null,
      membership: 'join' | 'invite' = 'join'
    ) => ({
      id: `@${name}:h`,
      name,
      role,
      membership,
    })
    const sorted = sortGroupMembers([
      m('Яна', null),
      m('Борис', null, 'invite'),
      m('Вера', 'moderator'),
      m('Антон', null),
      m('Глеб', 'admin'),
    ])
    expect(sorted.map((x) => x.name)).toEqual(['Глеб', 'Вера', 'Антон', 'Яна', 'Борис'])
  })
})
