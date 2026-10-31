// Фильтр входящих: кого прятать по репутации, статусу и вручную, чей это чат
// и что правила делают, пока профиля нет.

import { describe, expect, it } from 'vitest'

import type { Dialog } from '../types'
import {
  DEFAULT_CHAT_SCREEN,
  chatScreenActive,
  chatScreenNeedsProfile,
  sanitizeChatScreen,
  screenReason,
  screenSubjectOf,
  type ChatScreenPrefs,
} from './chat-screen'

/** Из списка проверенных (verified-addresses.ts). */
const VERIFIED = 'PKLxDhsyQNsSSzmLZDTwLL8GXz8zKM6PNy'
const STRANGER = 'PStranger1111111111111111111111111'

const prefs = (patch: Partial<ChatScreenPrefs> = {}): ChatScreenPrefs => ({
  ...sanitizeChatScreen(null),
  ...patch,
})
const byRules = (address: string) => ({ address, byRules: true })

describe('screenReason', () => {
  it('без правил не прячет никого', () => {
    expect(screenReason(prefs(), byRules(STRANGER), { reputation: -5 })).toBeNull()
    expect(chatScreenActive(DEFAULT_CHAT_SCREEN)).toBe(false)
  })

  it('репутация ниже порога — прячет, на пороге и выше — нет', () => {
    const p = prefs({ reputation: { on: true, below: 10 } })
    expect(screenReason(p, byRules(STRANGER), { reputation: 9.9 })).toBe('reputation')
    expect(screenReason(p, byRules(STRANGER), { reputation: 0 })).toBe('reputation')
    expect(screenReason(p, byRules(STRANGER), { reputation: 10 })).toBeNull()
    expect(screenReason(p, byRules(STRANGER), { reputation: '345.6' })).toBeNull()
  })

  it('профиля ещё нет — правила по репутации и бейджам молчат', () => {
    const p = prefs({
      reputation: { on: true, below: 10 },
      marks: { verified: 'any', moderator: 'only', shark: 'hide' },
    })
    expect(screenReason(p, byRules(STRANGER), undefined)).toBeNull()
  })

  it('«Скрывать» статус: прячет того, у кого он есть', () => {
    const p = prefs({ marks: { verified: 'any', moderator: 'any', shark: 'hide' } })
    expect(screenReason(p, byRules(STRANGER), { badges: ['shark'] })).toBe('mark')
    expect(screenReason(p, byRules(STRANGER), { badges: [] })).toBeNull()
  })

  it('«Только с ним»: без статуса прячет, у нескольких хватает любого', () => {
    const p = prefs({ marks: { verified: 'only', moderator: 'only', shark: 'any' } })
    expect(screenReason(p, byRules(STRANGER), { badges: [] })).toBe('mark')
    expect(screenReason(p, byRules(STRANGER), { badges: ['moderator'] })).toBeNull()
    // Проверенный — по списку адресов, бейджи не нужны.
    expect(screenReason(p, byRules(VERIFIED), { badges: [] })).toBeNull()
  })

  it('«Только проверенные» решается и без профиля: список — в приложении', () => {
    const p = prefs({ marks: { verified: 'only', moderator: 'any', shark: 'any' } })
    expect(screenReason(p, byRules(STRANGER), undefined)).toBe('mark')
    expect(screenReason(p, byRules(VERIFIED), undefined)).toBeNull()
    expect(chatScreenNeedsProfile(p)).toBe(false)
  })

  it('вручную: «всегда показывать» сильнее правил, «скрыть» — даже без правил', () => {
    const p = prefs({
      reputation: { on: true, below: 10 },
      people: { [STRANGER]: { rule: 'show', name: 'anna' } },
    })
    expect(screenReason(p, byRules(STRANGER), { reputation: 0 })).toBeNull()

    const hide = prefs({ people: { [VERIFIED]: { rule: 'hide', name: 'spam' } } })
    expect(chatScreenActive(hide)).toBe(true)
    expect(screenReason(hide, byRules(VERIFIED), { reputation: 1000 })).toBe('person')
  })

  it('чат, начатый вами, прячет только ручной выбор', () => {
    const p = prefs({ reputation: { on: true, below: 10 } })
    const mine = { address: STRANGER, byRules: false }
    expect(screenReason(p, mine, { reputation: 0 })).toBeNull()
    const hidden = { ...p, people: { [STRANGER]: { rule: 'hide' as const, name: '' } } }
    expect(screenReason(hidden, mine, { reputation: 0 })).toBe('person')
  })
})

describe('screenSubjectOf', () => {
  const toAddress = (id: string): string | null => (id.startsWith('@') ? `P_${id.slice(1)}` : null)
  const dialog = (patch: Partial<Dialog>): Dialog => ({
    id: '!room',
    partner: { id: '@anna:server', name: 'anna' },
    unreadCount: 0,
    ...patch,
  })

  it('личный чат — собеседник; начатый вами — только для ручного выбора', () => {
    expect(screenSubjectOf(dialog({}), toAddress)).toEqual({
      address: 'P_anna:server',
      byRules: true,
    })
    expect(screenSubjectOf(dialog({ startedByMe: true }), toAddress)).toEqual({
      address: 'P_anna:server',
      byRules: false,
    })
  })

  it('приглашение — по тому, кто пригласил, и в группу тоже', () => {
    const invite = dialog({
      partner: { id: '!group', name: 'Клуб' },
      group: { memberCount: 5, previewIds: [] },
      invite: { by: '@spam:server' },
    })
    expect(screenSubjectOf(invite, toAddress)).toEqual({
      address: 'P_spam:server',
      byRules: true,
    })
  })

  it('группа, mesh и неизвестный собеседник — не трогаем', () => {
    const group = dialog({
      partner: { id: '!group', name: 'Клуб' },
      group: { memberCount: 5, previewIds: [] },
    })
    expect(screenSubjectOf(group, toAddress)).toBeNull()
    expect(screenSubjectOf(dialog({ transport: 'meshtastic' }), toAddress)).toBeNull()
    expect(screenSubjectOf(dialog({ partner: { id: '!room', name: 'Чат' } }), toAddress)).toBeNull()
  })
})

describe('sanitizeChatScreen', () => {
  it('чужое и сломанное отбрасывает, недостающее — по умолчанию', () => {
    expect(
      sanitizeChatScreen({
        reputation: { on: true, below: 'x' },
        marks: { shark: 'only', moderator: 'nope', alien: 'hide' },
        people: {
          PA: { rule: 'hide', name: 'a' },
          PB: { rule: 'maybe' },
          PC: { rule: 'show' },
        },
      })
    ).toEqual({
      reputation: { on: true, below: 10 },
      marks: { verified: 'any', moderator: 'any', shark: 'only' },
      people: { PA: { rule: 'hide', name: 'a' }, PC: { rule: 'show', name: '' } },
    })
  })
})
