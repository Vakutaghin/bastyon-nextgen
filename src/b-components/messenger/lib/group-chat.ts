// Групповые чаты Matrix в том виде, в каком их заводит прежний клиент
// (bastyon-chat): название с «@» в начале, описание с «_» вместо пробелов,
// картинка — поле `avatarUrl` события m.room.avatar (data:-строка или адрес),
// роли — уровни m.room.power_levels: 100 — админ, 50 — модератор.
//
// Комната здесь duck-typed: сюда приходят и комнаты matrix-js-sdk, и фейки тестов.

import { t } from '@/i18n'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

interface StateEventLike {
  getContent?: () => Record<string, unknown> | undefined
  event?: { content?: Record<string, unknown> }
}

interface GroupMemberLike {
  userId: string
  membership?: string
  powerLevel?: number
}

export interface GroupRoomLike {
  currentState?: {
    getStateEvents?: (
      type: string,
      stateKey: string
    ) => StateEventLike | StateEventLike[] | null | undefined
    getMembers?: () => GroupMemberLike[]
  }
  getJoinRule?: () => string
}

export type GroupRole = 'admin' | 'moderator'

export interface GroupMemberEntry {
  id: string
  membership: 'join' | 'invite'
  role: GroupRole | null
}

/** Имя личной комнаты: `#` и SHA-224 двух id. Названием группы оно не бывает. */
const HASH_ROOM_NAME = /^#[0-9a-f]{56}$/i

function stateContent(room: GroupRoomLike, type: string): Record<string, unknown> {
  const got = room.currentState?.getStateEvents?.(type, '')
  const ev = Array.isArray(got) ? got[0] : got
  return ev?.getContent?.() ?? ev?.event?.content ?? {}
}

/** Название группы без «@», которым прежний клиент помечает группы. */
export function groupRoomName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const name = raw.trim()
  if (HASH_ROOM_NAME.test(name)) return ''
  return name.replace(/^@+/, '').trim()
}

/** Описание: прежний клиент хранит его с «_» вместо пробелов. */
export function groupTopic(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/_/g, ' ').trim() : ''
}

/**
 * Картинка группы: адрес для <img>. Прежний клиент кладёт её в `avatarUrl`
 * (обычно data:-строкой), стандартный Matrix — mxc-ссылкой в `url`.
 */
export function groupAvatarSrc(
  content: Record<string, unknown>,
  mxcToHttp: (mxc: string) => string | undefined
): string | undefined {
  const legacy = content.avatarUrl
  if (typeof legacy === 'string' && legacy) {
    if (legacy.startsWith('data:image/')) return legacy
    if (legacy.startsWith('mxc://')) return mxcToHttp(legacy)
    return resolveImageUrl(legacy)
  }
  const url = content.url
  return typeof url === 'string' && url.startsWith('mxc://') ? mxcToHttp(url) : undefined
}

export interface GroupState {
  name: string
  topic: string
  avatar: string | undefined
  isPublic: boolean
}

export function readGroupState(
  room: GroupRoomLike,
  mxcToHttp: (mxc: string) => string | undefined
): GroupState {
  return {
    name: groupRoomName(stateContent(room, 'm.room.name').name),
    topic: groupTopic(stateContent(room, 'm.room.topic').topic),
    avatar: groupAvatarSrc(stateContent(room, 'm.room.avatar'), mxcToHttp),
    isPublic: room.getJoinRule?.() === 'public',
  }
}

export function roleOf(level: number): GroupRole | null {
  if (level >= 100) return 'admin'
  if (level >= 50) return 'moderator'
  return null
}

/** Вступившие и приглашённые, с ролями. Вышедших и выгнанных нет. */
export function groupMembers(room: GroupRoomLike): GroupMemberEntry[] {
  const levels = stateContent(room, 'm.room.power_levels')
  const users = (levels.users ?? {}) as Record<string, unknown>
  const usersDefault = typeof levels.users_default === 'number' ? levels.users_default : 0
  const members = room.currentState?.getMembers?.() ?? []
  const result: GroupMemberEntry[] = []
  for (const m of members) {
    if (!m?.userId || (m.membership !== 'join' && m.membership !== 'invite')) continue
    const fromState = users[m.userId]
    const level =
      typeof fromState === 'number'
        ? fromState
        : typeof m.powerLevel === 'number'
          ? m.powerLevel
          : usersDefault
    result.push({ id: m.userId, membership: m.membership, role: roleOf(level) })
  }
  return result
}

/** Кого показать мозаикой вместо картинки группы: не себя, сначала вступивших. */
export function previewMemberIds(members: GroupMemberEntry[], myId: string, max = 4): string[] {
  const others = members.filter((m) => m.id !== myId)
  const joined = others.filter((m) => m.membership === 'join')
  const invited = others.filter((m) => m.membership === 'invite')
  return [...joined, ...invited].slice(0, max).map((m) => m.id)
}

/** Группа без названия: имена участников, как у прежнего клиента, но не больше трёх. */
export function membersTitle(names: string[], others: number): string {
  const shown = names.filter(Boolean).slice(0, 3)
  if (shown.length === 0) return t('messenger.group.untitled')
  const list = shown.join(', ')
  const rest = others - shown.length
  return rest > 0 ? t('messenger.group.andMore', { names: list, n: rest }) : list
}

const ROLE_ORDER: Record<string, number> = { admin: 0, moderator: 1, none: 2 }

/** Порядок в списке участников: админы, модераторы, остальные; не принявшие приглашение — в конце. */
export function sortGroupMembers<T extends GroupMemberEntry & { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const inv = Number(a.membership === 'invite') - Number(b.membership === 'invite')
    if (inv) return inv
    const role = ROLE_ORDER[a.role ?? 'none']! - ROLE_ORDER[b.role ?? 'none']!
    if (role) return role
    return a.name.localeCompare(b.name)
  })
}
