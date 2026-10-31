/**
 * Фильтр входящих: чьи чаты прятать из списка — по репутации, по статусу
 * («Проверен», «Модератор», «Акула») и вручную, по человеку. Работает только
 * на этом устройстве: ни собеседник, ни сервер чатов о нём не знают.
 *
 * Смотрим на того, кто пишет: в личном чате — на собеседника, в приглашении —
 * на того, кто пригласил. Чат, который начали вы, правила не прячут — только
 * ручной выбор. Группы, где вы уже состоите, каналы и mesh фильтр не трогает:
 * там нет одного «кто пишет».
 */

import { isUserVerified, type VerifiableProfile } from '@/helpers/profile/is-user-verified'

import { isMeshTransport, type Dialog } from '../types'

export type ScreenMark = 'verified' | 'moderator' | 'shark'

export const SCREEN_MARKS: readonly ScreenMark[] = ['verified', 'moderator', 'shark']

/**
 * Что делать со статусом: неважно; прятать тех, у кого он есть; прятать тех,
 * у кого его нет (показывать только с ним). «Только с ним» у нескольких
 * статусов — достаточно одного из них.
 */
export type MarkRule = 'any' | 'hide' | 'only'

export const MARK_RULES: readonly MarkRule[] = ['any', 'hide', 'only']

/** Человек вручную: всегда прятать или всегда показывать, что бы ни говорили правила. */
export type PersonRule = 'hide' | 'show'

export interface ScreenPerson {
  rule: PersonRule
  /** Ник, когда его добавили: список в настройках виден и без профиля. */
  name: string
}

export interface ChatScreenPrefs {
  reputation: { on: boolean; below: number }
  marks: Record<ScreenMark, MarkRule>
  /** Адрес → правило. */
  people: Record<string, ScreenPerson>
}

/** Порог по умолчанию: у новичка репутация 0, у пишущего постоянно — десятки и сотни. */
export const DEFAULT_REPUTATION_BELOW = 10

export const DEFAULT_CHAT_SCREEN: ChatScreenPrefs = {
  reputation: { on: false, below: DEFAULT_REPUTATION_BELOW },
  marks: { verified: 'any', moderator: 'any', shark: 'any' },
  people: {},
}

export function sanitizeChatScreen(raw: unknown): ChatScreenPrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rep = (
    value.reputation && typeof value.reputation === 'object' ? value.reputation : {}
  ) as Record<string, unknown>
  const below = Number(rep.below)
  const marksIn = (value.marks && typeof value.marks === 'object' ? value.marks : {}) as Record<
    string,
    unknown
  >
  const marks = { ...DEFAULT_CHAT_SCREEN.marks }
  for (const m of SCREEN_MARKS) {
    const rule = marksIn[m]
    if (MARK_RULES.includes(rule as MarkRule)) marks[m] = rule as MarkRule
  }
  const people: Record<string, ScreenPerson> = {}
  const peopleIn = value.people && typeof value.people === 'object' ? value.people : {}
  for (const [address, p] of Object.entries(peopleIn as Record<string, unknown>)) {
    const person = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
    if (!address || (person.rule !== 'hide' && person.rule !== 'show')) continue
    people[address] = {
      rule: person.rule,
      name: typeof person.name === 'string' ? person.name : '',
    }
  }
  return {
    reputation: {
      on: rep.on === true,
      below: Number.isFinite(below) ? below : DEFAULT_REPUTATION_BELOW,
    },
    marks,
    people,
  }
}

/** Прячет ли фильтр хоть кого-то — без этого кнопке «Скрытые» над списком не место. */
export function chatScreenActive(prefs: ChatScreenPrefs): boolean {
  return (
    prefs.reputation.on ||
    SCREEN_MARKS.some((m) => prefs.marks[m] !== 'any') ||
    Object.values(prefs.people).some((p) => p.rule === 'hide')
  )
}

/** Правилам нужен профиль с узла: репутация и бейджи модератора и «акулы». */
export function chatScreenNeedsProfile(prefs: ChatScreenPrefs): boolean {
  return prefs.reputation.on || prefs.marks.moderator !== 'any' || prefs.marks.shark !== 'any'
}

/** Профиль с узла, сколько о нём известно. */
export interface ScreenProfile extends VerifiableProfile {
  reputation?: unknown
}

export type ScreenReason = 'person' | 'reputation' | 'mark'

/** Чей чат для фильтра. */
export interface ScreenSubject {
  address: string
  /**
   * Под общие правила — репутацию и статусы. Чат, начатый вами, — нет:
   * его прячет только ручной выбор.
   */
  byRules: boolean
}

/**
 * Почему чат спрятан; `null` — показываем. Профиль ещё не пришёл — правила
 * по репутации и бейджам молчат: лучше показать лишний чат, чем спрятать
 * знакомого.
 */
export function screenReason(
  prefs: ChatScreenPrefs,
  subject: ScreenSubject,
  profile: ScreenProfile | null | undefined
): ScreenReason | null {
  const { address } = subject
  const manual = prefs.people[address]?.rule
  if (manual === 'show') return null
  if (manual === 'hide') return 'person'
  if (!subject.byRules) return null

  if (prefs.reputation.on && profile) {
    const rep = Number(profile.reputation ?? 0)
    if (Number.isFinite(rep) && rep < prefs.reputation.below) return 'reputation'
  }

  const badges = Array.isArray(profile?.badges) ? (profile.badges as unknown[]) : null
  /** Есть ли статус; `undefined` — не знаем, пока нет профиля. */
  const has = (m: ScreenMark): boolean | undefined => {
    if (m === 'verified') return isUserVerified(profile, address)
    return badges ? badges.includes(m) : undefined
  }
  if (SCREEN_MARKS.some((m) => prefs.marks[m] === 'hide' && has(m) === true)) return 'mark'
  const only = SCREEN_MARKS.filter((m) => prefs.marks[m] === 'only')
  if (only.length && only.every((m) => has(m) === false)) return 'mark'
  return null
}

/**
 * Чей чат: пригласившего или собеседника в личном чате; `null` — группа,
 * mesh или собеседник неизвестен, фильтр чат не трогает.
 */
export function screenSubjectOf(
  dialog: Pick<Dialog, 'transport' | 'invite' | 'group' | 'meshKind' | 'partner' | 'startedByMe'>,
  toAddress: (matrixId: string) => string | null
): ScreenSubject | null {
  if (isMeshTransport(dialog.transport)) return null
  if (dialog.invite) {
    const address = dialog.invite.by ? toAddress(dialog.invite.by) : null
    return address ? { address, byRules: true } : null
  }
  if (dialog.group || dialog.meshKind) return null
  const address = toAddress(dialog.partner.id)
  return address ? { address, byRules: !dialog.startedByMe } : null
}
